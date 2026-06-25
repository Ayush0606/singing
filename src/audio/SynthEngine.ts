// Harmonia Interactive Web Audio Synthesis Engine

interface Formant {
  f: number; // Frequency in Hz
  q: number; // Q factor
  g: number; // Gain (linear multiplier)
}

// Soprano / Female vocal formants for different vowels
const VOWEL_FORMANTS: Record<'a' | 'o' | 'i' | 'u', Formant[]> = {
  a: [
    { f: 800, q: 12, g: 1.0 },
    { f: 1150, q: 10, g: 0.6 },
    { f: 2900, q: 8, g: 0.4 }
  ],
  o: [
    { f: 450, q: 12, g: 1.0 },
    { f: 800, q: 10, g: 0.5 },
    { f: 2830, q: 8, g: 0.3 }
  ],
  i: [
    { f: 310, q: 15, g: 1.0 },
    { f: 2300, q: 12, g: 0.7 },
    { f: 2900, q: 10, g: 0.5 }
  ],
  u: [
    { f: 310, q: 12, g: 1.0 },
    { f: 670, q: 10, g: 0.4 },
    { f: 2200, q: 8, g: 0.2 }
  ]
};

// MIDI note to frequency helper
const midiToFreq = (note: number): number => {
  return 440 * Math.pow(2, (note - 69) / 12);
};

export class SynthEngine {
  private static instance: SynthEngine | null = null;

  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;
  public vocalAnalyser: AnalyserNode | null = null;

  private isPlaying = false;
  private currentChapter: 1 | 2 | 3 = 1;
  private bpm = 90;
  private stepInterval: number | null = null;
  private currentStep = 0;

  // Effects
  private delayNode: DelayNode | null = null;
  private delayGain: GainNode | null = null;

  // Vocal Timbre
  private currentVowel: 'a' | 'o' | 'i' | 'u' = 'a';
  private formantFilters: BiquadFilterNode[] = [];
  private vocalOsc: OscillatorNode | null = null;
  private vocalOsc2: OscillatorNode | null = null; // Detuned copy for richness
  private vocalLFO: OscillatorNode | null = null;
  private vocalLfoGain: GainNode | null = null;
  private vocalGain: GainNode | null = null;


  private constructor() {
    // Lazy initialisation of Audio Context upon user interaction
  }

  public static getInstance(): SynthEngine {
    if (!SynthEngine.instance) {
      SynthEngine.instance = new SynthEngine();
    }
    return SynthEngine.instance;
  }

  public init() {
    if (this.ctx) return;

    // Use standard or webkit AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Nodes
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // moderate default volume

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    
    this.vocalAnalyser = this.ctx.createAnalyser();
    this.vocalAnalyser.fftSize = 128;

    // Echo/Delay Setup
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayGain = this.ctx.createGain();
    
    this.delayNode.delayTime.setValueAtTime(0.4, this.ctx.currentTime);
    this.delayGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    // Route delay feedback loop
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.delayNode);

    // Route delay output to master
    this.delayNode.connect(this.masterGain);

    // Master routing: masterGain -> analyser -> destination
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Build Formant Synthesizer Nodes
    this.setupVocalSynthesizer();
  }

  private setupVocalSynthesizer() {
    if (!this.ctx || !this.masterGain || !this.vocalAnalyser) return;

    this.vocalGain = this.ctx.createGain();
    this.vocalGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // start silent

    // LFO for vocal vibrato (pitch wobble)
    this.vocalLFO = this.ctx.createOscillator();
    this.vocalLFO.frequency.setValueAtTime(5.8, this.ctx.currentTime); // ~5.8Hz vibrato

    this.vocalLfoGain = this.ctx.createGain();
    this.vocalLfoGain.gain.setValueAtTime(1.5, this.ctx.currentTime); // vibrato depth (cents/Hz offset)

    this.vocalLFO.connect(this.vocalLfoGain);
    this.vocalLFO.start();

    // Parallel formant filter bank (3 biquad filters)
    this.formantFilters = [];
    const filterSumNode = this.ctx.createGain();
    filterSumNode.gain.setValueAtTime(0.4, this.ctx.currentTime); // overall formant mix volume

    for (let i = 0; i < 3; i++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      this.formantFilters.push(filter);
      
      // Connect filter output to vocal gain
      filter.connect(filterSumNode);
    }

    // Connect sum node to vocal gain and separate vocal analyzer
    filterSumNode.connect(this.vocalAnalyser);
    filterSumNode.connect(this.vocalGain);

    // Vocal Gain connects to delay and master
    this.vocalGain.connect(this.masterGain);
    if (this.delayNode) {
      this.vocalGain.connect(this.delayNode);
    }

    this.updateVocalVowel(this.currentVowel);
  }

  public setVocalVowel(vowel: 'a' | 'o' | 'i' | 'u') {
    this.currentVowel = vowel;
    this.updateVocalVowel(vowel);
  }

  private updateVowelFilters(formants: Formant[]) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Smoothly transition formant frequencies and gains
    for (let i = 0; i < 3; i++) {
      if (this.formantFilters[i] && formants[i]) {
        const filter = this.formantFilters[i];
        const formant = formants[i];
        
        filter.frequency.exponentialRampToValueAtTime(formant.f, now + 0.15);
        filter.Q.exponentialRampToValueAtTime(formant.q, now + 0.15);
        // Note: linear gain multiplier is handled internally or visually. Since Web Audio Biquad Filter 
        // bandpass doesn't have an independent gain property, we can adjust the Q and resonance, 
        // or just let the parallel mix remain balanced. Ramping Q adjusts the band sharpness.
      }
    }
  }

  private updateVocalVowel(vowel: 'a' | 'o' | 'i' | 'u') {
    const formants = VOWEL_FORMANTS[vowel];
    this.updateVowelFilters(formants);
  }

  public setChapter(chapter: 1 | 2 | 3) {
    this.currentChapter = chapter;
    if (chapter === 1) {
      this.bpm = 90;
      if (this.delayNode && this.ctx) {
        this.delayNode.delayTime.setValueAtTime(0.5, this.ctx.currentTime);
      }
    } else if (chapter === 2) {
      this.bpm = 122;
      if (this.delayNode && this.ctx) {
        this.delayNode.delayTime.setValueAtTime(0.246, this.ctx.currentTime); // tempo sync eighth note
      }
    } else {
      this.bpm = 75;
      if (this.delayNode && this.ctx) {
        this.delayNode.delayTime.setValueAtTime(0.8, this.ctx.currentTime); // slow ambient echo
      }
    }

    if (this.isPlaying) {
      this.restartSequencer();
    }
  }

  public start() {
    this.init();
    if (this.isPlaying) return;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = true;
    this.currentStep = 0;
    this.startSequencer();
  }

  public stop() {
    this.isPlaying = false;
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    
    // Silence singing vocal
    if (this.vocalGain && this.ctx) {
      this.vocalGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.vocalGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public setVolume(volume: number) {
    if (!this.ctx || !this.masterGain) return;
    // Map slider 0-1 to gain 0-0.8 logarithmically/smoothly
    const target = volume * 0.7;
    this.masterGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.1);
  }

  private startSequencer() {
    const stepTimeMs = (60 / this.bpm) * 1000 * 0.5; // Eighth notes
    this.stepInterval = window.setInterval(() => {
      this.playSequencerStep();
      this.currentStep = (this.currentStep + 1) % 16;
    }, stepTimeMs);
  }

  private restartSequencer() {
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
    }
    this.startSequencer();
  }

  // Sequencer background patterns
  private playSequencerStep() {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const step = this.currentStep;

    if (this.currentChapter === 1) {
      // CHAPTER 1: Calm Meadow
      // Arpeggiate soft acoustic chords (A minor, F major, C major, G major)
      // Step: 0 to 15
      const chords = [
        [57, 60, 64], // Am (A3, C4, E4)
        [53, 57, 60], // F (F3, A3, C4)
        [48, 52, 55], // C (C3, E3, G3)
        [55, 59, 62]  // G (G3, B3, D4)
      ];
      
      const chordIndex = Math.floor(step / 4);
      const chord = chords[chordIndex];
      const noteToPlay = chord[step % chord.length] + 12; // Transpose up for bell feel

      // Play soft sine bell
      if (step % 2 === 0) {
        this.playPluckNote(noteToPlay, 0.08, 1.2, 'sine');
      }

      // Occasional drone bass note on step 0, 4, 8, 12
      if (step % 4 === 0) {
        const bassNote = chord[0] - 12; // deep root note
        this.playPluckNote(bassNote, 0.12, 2.5, 'triangle');
      }

    } else if (this.currentChapter === 2) {
      // CHAPTER 2: Neon Pulse
      // Cyberpunk driving rhythm
      // Root loop: E minor, C major, D major, B minor
      const bassChords = [40, 36, 38, 35]; // E1, C1, D1, B0
      const chordIdx = Math.floor(step / 4);
      const bassRoot = bassChords[chordIdx];

      // Bass rhythm: steady 16th/8th drive
      // Play bass synth
      let bassVelocity = 0.18;
      if (step % 4 === 0) bassVelocity = 0.25; // accent downbeat
      
      this.playPluckNote(bassRoot + 12, bassVelocity, 0.35, 'sawtooth', 250); // punchy lowpass bass

      // Electro Drums
      if (step % 4 === 0) {
        // Kick drum
        this.playKickDrum(now);
      }
      if (step % 4 === 2) {
        // Snare drum
        this.playSnareDrum(now);
      }
      if (step % 2 === 1) {
        // Hihat
        this.playHihat(now);
      }

      // Synth pad arpeggio
      const padChords = [
        [64, 67, 71, 74], // Em7 (E4, G4, B4, D5)
        [60, 64, 67, 72], // Cmaj7 (C4, E4, G4, C5)
        [62, 66, 69, 74], // D7 (D4, F#4, A4, D5)
        [59, 62, 66, 71]  // Bm7 (B3, D4, F#4, B4)
      ];
      const activePadChord = padChords[chordIdx];
      const arpNote = activePadChord[step % activePadChord.length];
      
      if (step % 2 === 0) {
        this.playPluckNote(arpNote, 0.08, 0.5, 'triangle');
      }

    } else {
      // CHAPTER 3: Cosmic Symphony
      // Slow soaring orchestral pad (C Major, G Major, A minor, F Major)
      const cosmicChords = [
        [48, 55, 60, 64, 67], // C maj 9 (C2, G2, C3, E3, G3)
        [43, 50, 55, 59, 62], // G maj (G1, D2, G2, B2, D3)
        [45, 52, 57, 60, 64], // Am (A1, E2, A2, C3, E3)
        [41, 48, 53, 57, 60]  // F maj (F1, C2, F2, A2, C3)
      ];
      
      const chordIndex = Math.floor(step / 4);
      const chord = cosmicChords[chordIndex];

      // At step 0 of each chord, trigger a lush slow-attack pad
      if (step % 4 === 0) {
        chord.forEach((note) => {
          this.playPadNote(note, 0.05, 3.5);
        });
      }
      
      // Random cosmic stars blinking (very high notes)
      if (step % 3 === 0 && Math.random() > 0.4) {
        const starNotes = [72, 74, 76, 79, 81, 84]; // Pentatonic C
        const randNote = starNotes[Math.floor(Math.random() * starNotes.length)];
        this.playPluckNote(randNote, 0.05, 2.0, 'sine');
      }
    }
  }

  // Play a short pluck note (synth/bell/bass)
  private playPluckNote(midiNote: number, velocity: number, duration: number, type: OscillatorType, filterCutoff?: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freq = midiToFreq(midiNote);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // Apply filter if specified
    if (filterCutoff) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterCutoff, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + duration);
      filter.Q.setValueAtTime(4, now);
      
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.masterGain);

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 0.02); // quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // smooth release

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  // Play a slow ambient pad note
  private playPadNote(midiNote: number, velocity: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freq = midiToFreq(midiNote);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    // Add tiny detune for chorus/ensemble effect
    osc.detune.setValueAtTime(Math.random() * 15 - 7.5, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(800, now + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(velocity, now + 1.2); // slow attack
    gain.gain.setValueAtTime(velocity, now + duration - 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // slow release

    osc.start(now);
    osc.stop(now + duration + 0.2);
  }

  // Drum Synthesizers
  private playKickDrum(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.start(time);
    osc.stop(time + 0.35);
  }

  private playSnareDrum(time: number) {
    if (!this.ctx || !this.masterGain) return;

    // Buffer for noise
    const bufferSize = this.ctx.sampleRate * 0.2; // 0.2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1000, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Tone snap
    const snap = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(180, time);
    snapGain.gain.setValueAtTime(0.18, time);
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    snap.connect(snapGain);
    snapGain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.22);
    snap.start(time);
    snap.stop(time + 0.12);
  }

  private playHihat(time: number) {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(10000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.06);
  }

  // --- SINGING VOCAL SYNTH CONTROL ---

  // Trigger Aria to start singing a specific pitch/note
  public startSinging(midiNote: number) {
    if (!this.ctx || !this.vocalGain || !this.vocalLfoGain) return;
    const now = this.ctx.currentTime;
    const targetFreq = midiToFreq(midiNote);

    // Stop current vocal oscillator if it exists
    this.stopSinging();

    // Create main oscillator (sawtooth/triangle blend works well for vocal chords)
    this.vocalOsc = this.ctx.createOscillator();
    this.vocalOsc.type = 'sawtooth';
    this.vocalOsc.frequency.setValueAtTime(targetFreq, now);

    // Connect LFO pitch wobble to oscillator frequency
    this.vocalLfoGain.connect(this.vocalOsc.frequency);

    // Create a detuned sub/super oscillator for thick vocal sound
    this.vocalOsc2 = this.ctx.createOscillator();
    this.vocalOsc2.type = 'triangle';
    this.vocalOsc2.frequency.setValueAtTime(targetFreq, now);
    this.vocalOsc2.detune.setValueAtTime(8, now); // detune slightly sharp
    this.vocalLfoGain.connect(this.vocalOsc2.frequency);

    // Connect oscillators to the formant filter bank
    for (const filter of this.formantFilters) {
      this.vocalOsc.connect(filter);
      this.vocalOsc2.connect(filter);
    }

    // Set voice volume envelope: gentle fade-in
    this.vocalGain.gain.cancelScheduledValues(now);
    this.vocalGain.gain.setValueAtTime(0, now);
    this.vocalGain.gain.linearRampToValueAtTime(0.35, now + 0.2); // 200ms singing vocal attack

    this.vocalOsc.start(now);
    this.vocalOsc2.start(now);
  }

  // Update pitch mid-singing for smooth slides
  public slideSingingPitch(midiNote: number) {
    if (!this.ctx || !this.vocalOsc || !this.vocalOsc2) return;
    const now = this.ctx.currentTime;
    const targetFreq = midiToFreq(midiNote);

    // Slide vocal oscillator frequencies over 180ms
    this.vocalOsc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.18);
    this.vocalOsc2.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.18);
  }

  // Silence singing vocal
  public stopSinging() {
    if (!this.ctx || !this.vocalGain) return;
    const now = this.ctx.currentTime;

    // Fade out vocal sound
    this.vocalGain.gain.cancelScheduledValues(now);
    this.vocalGain.gain.setValueAtTime(this.vocalGain.gain.value, now);
    this.vocalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); // 300ms vocal release

    // Kill oscillators after fadeout completes
    const osc1 = this.vocalOsc;
    const osc2 = this.vocalOsc2;
    setTimeout(() => {
      try {
        if (osc1) osc1.stop();
        if (osc2) osc2.stop();
      } catch (e) {
        // already stopped
      }
    }, 350);

    this.vocalOsc = null;
    this.vocalOsc2 = null;
  }
}
export default SynthEngine;
