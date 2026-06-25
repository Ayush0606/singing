import React, { useRef, useEffect } from 'react';
import SynthEngine from '../audio/SynthEngine';

interface AudioVisualizerProps {
  chapter: 1 | 2 | 3;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ chapter }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const synth = SynthEngine.getInstance();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions dynamically based on parent/window
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Byte arrays for audio data
    const freqArray = new Uint8Array(128);
    const vocalTimeArray = new Uint8Array(128);

    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear canvas with trace transparency for motion-blur ghosting
      ctx.fillStyle = 'rgba(7, 8, 20, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Get color scheme based on chapter
      let colorPrimary = '#00f3a6'; // meadow green
      let colorSecondary = '#00875c';
      
      if (chapter === 2) {
        colorPrimary = '#00f0ff'; // city cyan
        colorSecondary = '#ff007a'; // city pink
      } else if (chapter === 3) {
        colorPrimary = '#ffd700'; // cosmic gold
        colorSecondary = '#8a2be2'; // cosmic purple
      }

      // 1. DRAW BACKING TRACK EQUALIZER BARS (at the bottom)
      if (synth.analyser) {
        synth.analyser.getByteFrequencyData(freqArray);
        
        const barWidth = (width / freqArray.length) * 1.5;
        let x = 0;

        for (let i = 0; i < freqArray.length; i++) {
          const percent = freqArray[i] / 255;
          const barHeight = percent * (height * 0.45); // take up to 45% of height

          // Draw double-sided bars or bottom bars
          const grad = ctx.createLinearGradient(x, height, x, height - barHeight);
          grad.addColorStop(0, `${colorSecondary}11`); // fading tail
          grad.addColorStop(0.5, `${colorSecondary}aa`);
          grad.addColorStop(1, `${colorPrimary}ff`); // bright cap

          ctx.fillStyle = grad;
          // Rounded corners for bars
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          x += barWidth;
        }
      }

      // 2. DRAW GLOWING SINGING VOCAL WAVE (oscilloscope sweeping in the middle)
      if (synth.vocalAnalyser) {
        synth.vocalAnalyser.getByteTimeDomainData(vocalTimeArray);

        // Check if there is actual vocal activity (otherwise keep it as a calm flat line)
        let hasVocalActivity = false;
        for (let i = 0; i < vocalTimeArray.length; i++) {
          if (Math.abs(vocalTimeArray[i] - 128) > 3) {
            hasVocalActivity = true;
            break;
          }
        }

        ctx.beginPath();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = colorPrimary;
        ctx.shadowBlur = 15;
        ctx.shadowColor = colorPrimary;

        const sliceWidth = width / vocalTimeArray.length;
        let x = 0;

        for (let i = 0; i < vocalTimeArray.length; i++) {
          // Normalize standard 0-255 time domain byte to centered floating multiplier
          const v = vocalTimeArray[i] / 128.0; // 0.0 to 2.0
          
          // Map to middle Y, adding minor organic sway if silent
          const calmOffset = hasVocalActivity ? 0 : Math.sin(Date.now() * 0.003 + x * 0.02) * 1.5;
          const y = (v * (height * 0.35)) + (height * 0.15) + calmOffset;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();
        // Reset shadow properties for other drawing operations
        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [chapter, synth.analyser, synth.vocalAnalyser]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '180px',
        zIndex: 5,
        pointerEvents: 'none'
      }}
    />
  );
};
export default AudioVisualizer;
