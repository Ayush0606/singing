import React, { useState, useEffect } from 'react';
import { Volume2, Mic, MicOff, ChevronRight, ChevronLeft, RefreshCw, Music } from 'lucide-react';
import SynthEngine from '../audio/SynthEngine';

interface StoryHUDProps {
  chapter: 1 | 2 | 3;
  setChapter: (ch: 1 | 2 | 3) => void;
  narration: string;
  isMicActive: boolean;
  toggleMic: () => void;
  volume: number;
  setVolume: (vol: number) => void;
  micNote: string;
  micVolume: number;
  isCompleted: boolean;
  onRestart: () => void;
}

// Custom typewriter component for narration text
const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      setDisplayedText((prev) => {
        if (index < text.length) {
          const char = text.charAt(index);
          index++;
          return prev + char;
        } else {
          clearInterval(timer);
          return prev;
        }
      });
    }, 18); // 18ms per character typing speed
    
    return () => clearInterval(timer);
  }, [text]);

  return <span>{displayedText}</span>;
};

export const StoryHUD: React.FC<StoryHUDProps> = ({
  chapter,
  setChapter,
  narration,
  isMicActive,
  toggleMic,
  volume,
  setVolume,
  micNote,
  micVolume,
  isCompleted,
  onRestart
}) => {
  const synth = SynthEngine.getInstance();
  const [activeVowel, setActiveVowel] = useState<'a' | 'o' | 'i' | 'u'>('a');

  const handleVowelChange = (vow: 'a' | 'o' | 'i' | 'u') => {
    setActiveVowel(vow);
    synth.setVocalVowel(vow);
  };

  const getChapterName = (ch: number) => {
    switch (ch) {
      case 1: return 'Chapter 1: The Whispering Meadow';
      case 2: return 'Chapter 2: The Neon Pulse';
      case 3: return 'Chapter 3: The Cosmic Choir';
      default: return '';
    }
  };

  return (
    <div className={`hud-layer ${chapter === 1 ? 'meadow-theme' : chapter === 2 ? 'city-theme' : 'cosmic-theme'}`}>
      
      {/* Top Header Overlay */}
      <header className="interactive glass-panel hud-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Music className="animate-glow-pulse" style={{
            color: chapter === 1 ? 'var(--color-meadow)' : chapter === 2 ? 'var(--color-city)' : 'var(--color-cosmic)'
          }} />
          <span className="brand" style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Harmonia
          </span>
        </div>

        {/* Dynamic Chapter Status Indicator */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[1, 2, 3].map((num) => (
            <button
              key={num}
              onClick={() => setChapter(num as 1 | 2 | 3)}
              style={{
                background: chapter === num 
                  ? (num === 1 ? 'var(--color-meadow)' : num === 2 ? 'var(--color-city)' : 'var(--color-cosmic)') 
                  : 'rgba(255, 255, 255, 0.05)',
                color: chapter === num ? '#070814' : 'var(--color-text-secondary)',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'all 0.3s ease'
              }}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Global Settings Panel */}
        <div className="hud-settings">
          
          {/* Master Volume */}
          <div className="hud-volume-control">
            <Volume2 size={18} style={{ color: 'var(--color-text-secondary)' }} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="custom-slider"
              style={{ width: '80px' }}
            />
          </div>

          {/* Microphone Controller */}
          <div className="hud-mic-control">
            <button 
              onClick={toggleMic} 
              className={`btn ${isMicActive ? 'btn-theme' : ''}`}
              style={{ padding: '8px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
            >
              {isMicActive ? (
                <>
                  <Mic size={14} />
                  <span>Mic ON</span>
                </>
              ) : (
                <>
                  <MicOff size={14} style={{ color: 'var(--color-text-muted)' }} />
                  <span>Mic OFF</span>
                </>
              )}
            </button>
            
            {isMicActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="mic-pulse-indicator active" style={{
                  transform: `scale(${1 + micVolume * 1.5})`
                }} />
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)',
                  minWidth: '50px'
                }}>
                  {micNote ? `Note: ${micNote}` : 'Listening...'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Center Climax Celebration Screen */}
      {isCompleted && (
        <div className="interactive glass-panel" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '40px 60px',
          textAlign: 'center',
          maxWidth: '500px',
          borderWidth: '2px',
          borderColor: 'var(--color-cosmic)',
          boxShadow: 'var(--glow-cosmic-lg)',
          zIndex: 100
        }}>
          <h2 className="text-glow-cosmic" style={{ fontSize: '2.5rem', marginBottom: '16px' }}>RESTORED!</h2>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            Aria's song now echoes throughout the cosmos. Melody, rhythm, and harmony are bound together once again in eternal symphony.
          </p>
          <button onClick={onRestart} className="btn btn-primary" style={{ display: 'inline-flex', gap: '8px' }}>
            <RefreshCw size={16} />
            <span>Begin Aria's Journey Anew</span>
          </button>
        </div>
      )}

      {/* Bottom Interface HUD Overlay */}
      <footer className="hud-footer">
        {/* Story Text Box */}
        <div className="interactive glass-panel hud-story-box">
          <div style={{
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            fontWeight: 600,
            marginBottom: '8px',
            color: chapter === 1 ? 'var(--color-meadow)' : chapter === 2 ? 'var(--color-city)' : 'var(--color-cosmic)',
            textShadow: chapter === 1 ? 'var(--glow-meadow)' : chapter === 2 ? 'var(--glow-city)' : 'var(--glow-cosmic)'
          }}>
            {getChapterName(chapter)}
          </div>

          <div className="narration-box">
            <TypewriterText text={narration} />
          </div>

          {/* Controls Row (Navigation + Mobile Vowels) */}
          <div className="hud-controls-row">
            {/* Chapter Navigation Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setChapter(Math.max(1, chapter - 1) as 1 | 2 | 3)}
                disabled={chapter === 1}
                className="btn"
                style={{ opacity: chapter === 1 ? 0.3 : 1, cursor: chapter === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              {chapter < 3 ? (
                <button
                  onClick={() => setChapter(Math.min(3, chapter + 1) as 1 | 2 | 3)}
                  className="btn btn-primary"
                >
                  <span>Continue Journey</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={onRestart}
                  className="btn"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  <RefreshCw size={14} />
                  <span>Reset Story</span>
                </button>
              )}
            </div>

            {/* Compact Mobile Vowel Selector */}
            <div className="mobile-vowel-selector">
              {(['a', 'o', 'i', 'u'] as const).map((vow) => (
                <button
                  key={vow}
                  onClick={() => handleVowelChange(vow)}
                  className={`btn ${activeVowel === vow ? 'btn-theme' : ''}`}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    textTransform: 'uppercase',
                    minWidth: '38px',
                    height: '38px'
                  }}
                >
                  {vow}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Vowel Timbre Vocoder Control */}
        <div className="interactive glass-panel hud-vocoder-box">
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Vocal Vowel Timbre:
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {(['a', 'o', 'i', 'u'] as const).map((vow) => (
              <button
                key={vow}
                onClick={() => handleVowelChange(vow)}
                className={`btn ${activeVowel === vow ? 'btn-theme' : ''}`}
                style={{
                  padding: '8px 0',
                  fontSize: '0.9rem',
                  borderRadius: '8px',
                  textTransform: 'uppercase'
                }}
              >
                {vow}
              </button>
            ))}
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            lineHeight: '1.4',
            textAlign: 'center',
            marginTop: '4px'
          }}>
            {chapter === 1 && "Restoring Aria's voice notes."}
            {chapter === 2 && 'Change vowels to alter vocoder frequency bands.'}
            {chapter === 3 && 'Sing or Hum vowels into your mic to change colors!'}
          </div>
        </div>
      </footer>
    </div>
  );
};
export default StoryHUD;
