// Harmonia Microphone Input & Pitch/Volume Analyzer

export class MicAnalyzer {
  private static instance: MicAnalyzer | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Float32Array = new Float32Array(0);
  private isEnabled = false;

  private constructor() {}

  public static getInstance(): MicAnalyzer {
    if (!MicAnalyzer.instance) {
      MicAnalyzer.instance = new MicAnalyzer();
    }
    return MicAnalyzer.instance;
  }

  public async start(ctx: AudioContext) {
    if (this.isEnabled) return;
    
    this.audioContext = ctx;
    
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024; // high resolution for pitch
      const bufferLength = this.analyser.fftSize;
      this.dataArray = new Float32Array(bufferLength);

      this.source = this.audioContext.createMediaStreamSource(this.micStream);
      this.source.connect(this.analyser);
      
      // DO NOT connect the mic source to the AudioContext destination (speakers)
      // to avoid feedback howling!
      
      this.isEnabled = true;
    } catch (e) {
      console.error('Microphone access denied or error occurred:', e);
      this.isEnabled = false;
      throw e;
    }
  }

  public stop() {
    if (!this.isEnabled) return;

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
    }
    if (this.source) {
      this.source.disconnect();
    }
    
    this.micStream = null;
    this.source = null;
    this.analyser = null;
    this.isEnabled = false;
  }

  public isActive(): boolean {
    return this.isEnabled;
  }

  public getVolume(): number {
    if (!this.isEnabled || !this.analyser) return 0;
    
    this.analyser.getFloatTimeDomainData(this.dataArray as any);
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    // Multiply slightly to boost visual scaling
    return Math.min(rms * 2.5, 1.0);
  }

  // Autocorrelation pitch detection algorithm
  public getPitch(): { frequency: number; noteName: string; confidence: number } {
    if (!this.isEnabled || !this.analyser || !this.audioContext) {
      return { frequency: 0, noteName: '', confidence: 0 };
    }

    this.analyser.getFloatTimeDomainData(this.dataArray as any);
    const size = this.dataArray.length;
    const sampleRate = this.audioContext.sampleRate;

    // First check volume to ignore silent background static
    let rms = 0;
    for (let i = 0; i < size; i++) {
      const val = this.dataArray[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.015) {
      return { frequency: 0, noteName: '', confidence: 0 }; // too quiet
    }

    // Clip signal boundaries
    let r1 = 0;
    let r2 = size - 1;
    const thres = 0.2;
    for (let i = 0; i < size / 2; i++) {
      if (Math.abs(this.dataArray[i]) < thres) {
        r1 = i;
        break;
      }
    }
    for (let i = size - 1; i >= size / 2; i--) {
      if (Math.abs(this.dataArray[i]) < thres) {
        r2 = i;
        break;
      }
    }

    const c = this.dataArray.slice(r1, r2);
    const cSize = c.length;

    // Calculate autocorrelation
    const correlations = new Float32Array(cSize);
    for (let i = 0; i < cSize; i++) {
      for (let j = 0; j < cSize - i; j++) {
        correlations[i] += c[j] * c[j + i];
      }
    }

    // Find the first zero-crossing or local minimum
    let d = 0;
    while (d < cSize - 1 && correlations[d] > correlations[d + 1]) {
      d++;
    }

    // Find the absolute peak after the crossing
    let maxVal = -1;
    let maxPos = -1;
    for (let i = d; i < cSize - 1; i++) {
      if (correlations[i] > correlations[i - 1] && correlations[i] > correlations[i + 1]) {
        if (correlations[i] > maxVal) {
          maxVal = correlations[i];
          maxPos = i;
        }
      }
    }

    let frequency = 0;
    let confidence = 0;
    if (maxPos !== -1) {
      frequency = sampleRate / maxPos;
      confidence = maxVal / correlations[0];
    }

    // Accept human vocal pitch range (e.g. 80Hz - 1000Hz) with high confidence
    if (frequency > 75 && frequency < 1000 && confidence > 0.82) {
      const noteName = this.frequencyToNoteName(frequency);
      return { frequency, noteName, confidence };
    }

    return { frequency: 0, noteName: '', confidence: 0 };
  }

  private frequencyToNoteName(freq: number): string {
    const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
    const midi = Math.round(noteNum) + 69;
    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return noteStrings[noteIndex] + octave;
  }
}
export default MicAnalyzer;
