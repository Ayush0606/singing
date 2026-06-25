import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Play } from 'lucide-react';
import SynthEngine from './audio/SynthEngine';
import MicAnalyzer from './audio/MicAnalyzer';
import ExperienceCanvas from './components/ExperienceCanvas';
import StoryHUD from './components/StoryHUD';
import AudioVisualizer from './components/AudioVisualizer';

const DEFAULT_NARRATION = {
  1: "Aria has entered the Whispering Meadow, a silent cradle of flora. The ancient tree holds the memories of her lost melody. Click on the floating crystal nodes to awaken her voice.",
  2: "Entering the Neon Pulse city. The streets hum with raw rhythmic energy, but it remains disconnected. Click the neon drum pads to engage backing beats and tune her resonance.",
  3: "Ascending to the Cosmic Symphony. Space awaits the spark of union. Connect the stars to form the celestial constellation. Enable your microphone to sing/hum and drive the galaxy!"
};

export const App: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [chapter, setChapter] = useState<1 | 2 | 3>(1);
  const [narration, setNarration] = useState(DEFAULT_NARRATION[1]);
  
  // Audio state
  const [volume, setVolume] = useState(0.5);
  
  // Microphone pitch-tracking state
  const [isMicActive, setIsMicActive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [micPitch, setMicPitch] = useState(0);
  const [micNote, setMicNote] = useState('');
  
  // Story completed climax state
  const [isCompleted, setIsCompleted] = useState(false);
  
  const synth = SynthEngine.getInstance();
  const mic = MicAnalyzer.getInstance();
  
  const isUserSingingRef = useRef(false);

  // Initialise synthesizer volume
  useEffect(() => {
    if (hasStarted) {
      synth.setVolume(volume);
    }
  }, [volume, hasStarted]);

  // Handle Chapter changes
  const handleChapterChange = (nextCh: 1 | 2 | 3) => {
    setChapter(nextCh);
    setNarration(DEFAULT_NARRATION[nextCh]);
    if (hasStarted) {
      synth.setChapter(nextCh);
      synth.stopSinging(); // clear any holding notes
    }
  };

  // Start the experience (overcoming browser autoplay restrictions)
  const handleStartExperience = () => {
    setHasStarted(true);
    synth.start();
    synth.setVolume(volume);
    synth.setChapter(chapter);
  };

  // Toggle microphone access
  const handleToggleMic = async () => {
    if (!isMicActive) {
      try {
        synth.init(); // make sure audio context is active
        if (synth.ctx) {
          await mic.start(synth.ctx);
          setIsMicActive(true);
          setNarration("Microphone connected! Sing or hum into your mic. Aria's voice synthesizer will try to echo your pitch, and the visualizers will respond.");
        }
      } catch (err) {
        alert("Could not access microphone. Please check browser permissions.");
      }
    } else {
      mic.stop();
      setIsMicActive(false);
      synth.stopSinging();
      isUserSingingRef.current = false;
      setNarration("Microphone disabled. You can continue guiding Aria by clicking the 3D nodes.");
    }
  };

  // Effect to trace microphone pitch & volume to vocal synthesis
  useEffect(() => {
    let animFrame: number;

    const pitchLoop = () => {
      if (isMicActive && mic.isActive()) {
        const vol = mic.getVolume();
        setMicVolume(vol);

        const pitchData = mic.getPitch();
        setMicPitch(pitchData.frequency);
        setMicNote(pitchData.noteName);

        // If user is humming/singing loudly enough, pipe it to SynthEngine's vocal synthesizer!
        if (vol > 0.08 && pitchData.frequency > 0) {
          // Calculate MIDI pitch number
          const noteNum = 12 * (Math.log(pitchData.frequency / 440) / Math.log(2));
          const midiNote = Math.round(noteNum) + 69;

          if (!isUserSingingRef.current) {
            synth.startSinging(midiNote);
            isUserSingingRef.current = true;
          } else {
            // slide frequency smoothly for a sliding hum/sing response
            synth.slideSingingPitch(midiNote);
          }
        } else {
          // Silence vocal synth if user stops hum
          if (isUserSingingRef.current) {
            synth.stopSinging();
            isUserSingingRef.current = false;
          }
          setMicNote('');
        }
      }
      animFrame = requestAnimationFrame(pitchLoop);
    };

    if (isMicActive) {
      pitchLoop();
    } else {
      setMicVolume(0);
      setMicPitch(0);
      setMicNote('');
      if (isUserSingingRef.current) {
        synth.stopSinging();
        isUserSingingRef.current = false;
      }
    }

    return () => cancelAnimationFrame(animFrame);
  }, [isMicActive]);

  // Handle clicking 3D interactive nodes
  const handleNodeClick = (_nodeIdx: number, nodeText: string) => {
    setNarration(nodeText);
  };

  // Climax celebration (called when Chapter 3 constellation is complete)
  const handleClimaxComplete = () => {
    setIsCompleted(true);
    setNarration("Symphony Complete! Aria's voice rises in absolute harmony, healing the fabric of space. You did it!");
    
    // Shoot confetti fireworks!
    const duration = 4 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#00f3a6', '#00f0ff', '#ffd700', '#ff007a']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#00f3a6', '#00f0ff', '#ffd700', '#ff007a']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  // Reset entire experience
  const handleRestartExperience = () => {
    setIsCompleted(false);
    setChapter(1);
    setNarration(DEFAULT_NARRATION[1]);
    synth.setChapter(1);
    synth.stopSinging();
    isUserSingingRef.current = false;
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      
      {/* Intro / Splash Modal Overlay */}
      {!hasStarted && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1000,
          background: 'radial-gradient(circle at center, #0e112a 0%, #060814 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '600px',
            padding: '48px',
            borderWidth: '1px',
            borderColor: 'rgba(255,255,255,0.06)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <h1 className="animate-glow-pulse" style={{
              fontSize: '3rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '16px',
              background: 'linear-gradient(45deg, #00f3a6, #00f0ff, #ffd700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 20px rgba(0, 240, 255, 0.2)'
            }}>
              Harmonia
            </h1>
            <h3 style={{
              color: 'var(--color-text-secondary)',
              fontSize: '1.1rem',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              marginBottom: '24px'
            }}>
              The Lost Echoes
            </h3>

            <p style={{
              color: 'var(--color-text-secondary)',
              lineHeight: '1.7',
              fontSize: '0.95rem',
              marginBottom: '32px'
            }}>
              Guide Aria, a spirit of song, through a gorgeous 3D universe. Restoring melody, rhythm, and cosmic harmony will heal the cosmos.
              <br />
              <span style={{ color: '#ffd700', fontWeight: 500 }}>
                For the best experience, wear headphones and sing or hum into your microphone.
              </span>
            </p>

            <button onClick={handleStartExperience} className="btn btn-primary" style={{
              fontSize: '1.05rem',
              padding: '16px 36px',
              borderRadius: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 0 30px rgba(255,255,255,0.15)'
            }}>
              <Play size={18} fill="currentColor" />
              <span>Enter Harmonia</span>
            </button>
          </div>
        </div>
      )}

      {/* Screen Backdrop Gradient */}
      <div className="canvas-backdrop" />

      {/* 3D WebGL Canvas Layer */}
      {hasStarted && (
        <ExperienceCanvas
          chapter={chapter}
          onNodeClick={handleNodeClick}
          isMicActive={isMicActive}
          micVolume={micVolume}
          micPitch={micPitch}
          onClimax={handleClimaxComplete}
        />
      )}

      {/* 2D HUD Layout Overlay */}
      {hasStarted && (
        <StoryHUD
          chapter={chapter}
          setChapter={handleChapterChange}
          narration={narration}
          isMicActive={isMicActive}
          toggleMic={handleToggleMic}
          volume={volume}
          setVolume={setVolume}
          micNote={micNote}
          micVolume={micVolume}
          isCompleted={isCompleted}
          onRestart={handleRestartExperience}
        />
      )}

      {/* Real-time Audio Visualizer overlay */}
      {hasStarted && <AudioVisualizer chapter={chapter} />}

      {/* Chapter Reveal Title */}
      {hasStarted && (
        <div key={chapter} className="chapter-title-overlay">
          <div style={{ fontSize: '0.9rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
            Now Playing
          </div>
          <h2 className={chapter === 1 ? 'text-glow-meadow' : chapter === 2 ? 'text-glow-city' : 'text-glow-cosmic'} style={{
            fontSize: '3rem',
            marginTop: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.15em'
          }}>
            {chapter === 1 ? 'Meadow' : chapter === 2 ? 'Neon City' : 'Cosmos'}
          </h2>
        </div>
      )}
    </div>
  );
};
export default App;
