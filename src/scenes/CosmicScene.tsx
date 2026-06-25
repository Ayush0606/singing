import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import SynthEngine from '../audio/SynthEngine';

interface CosmicSceneProps {
  onNodeClick: (nodeIndex: number, text: string) => void;
  isMicActive: boolean;
  micVolume: number;
  micPitch: number;
  onClimax: () => void;
}

const COSMIC_STARS = [
  { note: 79, vowel: 'a' as const, label: 'Stella Harmony', text: 'Aria joined her voice with the stars. A golden thread of melody connected the sky.', pos: [-4, 3, -3] as [number, number, number] },
  { note: 81, vowel: 'o' as const, label: 'Luna Chord', text: 'The moon resonated with a deep chord. The constellation began to take shape.', pos: [-1.5, 4, 3] as [number, number, number] },
  { note: 84, vowel: 'i' as const, label: 'Aether Echo', text: 'Etheric echoes pulsed through the galaxy. The bridge of song grew stronger.', pos: [3.5, 3.5, 2] as [number, number, number] },
  { note: 86, vowel: 'u' as const, label: 'Sola Pulse', text: 'A burst of solar energy surged. Only one star remained to complete the loop.', pos: [4, 1, -3.5] as [number, number, number] },
  { note: 88, vowel: 'a' as const, label: 'Cosmic Union', text: 'The final connection is made! Harmonia is restored, and the stars erupt in celebration!', pos: [0, -1, -5] as [number, number, number] }
];

export const CosmicScene: React.FC<CosmicSceneProps> = ({ onNodeClick, isMicActive, micVolume, micPitch, onClimax }) => {
  const synth = SynthEngine.getInstance();
  const [visitedNodes, setVisitedNodes] = useState<number[]>([]);
  const galaxyRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const freqData = useRef(new Uint8Array(128));

  // Handle clicking a star
  const handleStarClick = (idx: number) => {
    // Prevent duplicate triggers if already clicked in this session
    if (visitedNodes.includes(idx)) {
      // Still trigger sound so they can play it again
      synth.setVocalVowel(COSMIC_STARS[idx].vowel);
      synth.startSinging(COSMIC_STARS[idx].note);
      return;
    }

    const nextList = [...visitedNodes, idx];
    setVisitedNodes(nextList);

    // Audio Trigger
    synth.setVocalVowel(COSMIC_STARS[idx].vowel);
    synth.startSinging(COSMIC_STARS[idx].note);

    // Update HUD
    onNodeClick(idx, COSMIC_STARS[idx].text);

    // Check if climax is reached
    if (nextList.length === COSMIC_STARS.length) {
      setTimeout(() => {
        onClimax();
      }, 1000);
    }
  };

  // Generate 600 star particles in spiral galaxy arms
  const numParticles = 600;
  const particleData = useMemo(() => {
    const pos = new Float32Array(numParticles * 3);
    const colors = new Float32Array(numParticles * 3);
    
    const colorGold = new THREE.Color('#ffd700');
    const colorPurple = new THREE.Color('#8a2be2');

    for (let i = 0; i < numParticles; i++) {
      // Spiral galaxy math
      const r = Math.random() * 18 + 1.0;
      const angle = (i % 3) * ((2 * Math.PI) / 3) + r * 0.4 + (Math.random() - 0.5) * 0.35;
      
      const x = Math.sin(angle) * r;
      const z = Math.cos(angle) * r;
      const y = (Math.random() - 0.5) * 2.5 + Math.sin(r * 0.5) * 0.5;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Color interpolation (inner gold, outer purple)
      const mixedColor = new THREE.Color().lerpColors(colorGold, colorPurple, r / 18);
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }
    return { pos, colors };
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // Get music frequencies
    let avgFreq = 0;
    if (synth.analyser) {
      synth.analyser.getByteFrequencyData(freqData.current);
      let sum = 0;
      for (let i = 0; i < freqData.current.length; i++) {
        sum += freqData.current[i];
      }
      avgFreq = sum / freqData.current.length;
    }

    // Audio-reactive parameters
    const soundFactor = avgFreq / 255; // 0 to 1
    const micFactor = isMicActive ? micVolume : 0; // 0 to 1
    
    // Scale galaxy and spin speed based on volume + mic
    if (galaxyRef.current) {
      const targetSpeed = 0.05 + soundFactor * 0.15 + micFactor * 0.4;
      galaxyRef.current.rotation.y += targetSpeed * 0.05;
      
      // Pulsing material size
      const mat = galaxyRef.current.material as THREE.PointsMaterial;
      if (mat) {
        mat.size = 0.08 + soundFactor * 0.1 + micFactor * 0.35;
      }
    }

    // Pulse core size and emissive glow
    if (coreRef.current) {
      const coreScale = 1.0 + Math.sin(time * 2.0) * 0.05 + micFactor * 0.4 + soundFactor * 0.15;
      coreRef.current.scale.setScalar(coreScale);
      
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        // Change core color based on pitch if mic is active
        if (isMicActive && micPitch > 0) {
          // Hue shift based on frequency (80Hz to 800Hz map)
          const hue = (micPitch - 80) / 720; // 0 to 1
          const col = new THREE.Color().setHSL(hue % 1.0, 0.9, 0.5);
          mat.emissive.lerp(col, 0.1);
        } else {
          // Default golden emissive
          mat.emissive.set('#ffd700');
        }
        mat.emissiveIntensity = 1.5 + Math.sin(time * 4) * 0.3 + micFactor * 2.0;
      }
    }
  });

  // Calculate constellation line points to render
  const linePoints = useMemo(() => {
    if (visitedNodes.length < 2) return [];
    
    const points: [number, number, number][] = [];
    visitedNodes.forEach((nodeIdx) => {
      points.push(COSMIC_STARS[nodeIdx].pos);
    });
    return points;
  }, [visitedNodes]);

  return (
    <group>
      {/* Space Ambient Lights */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[0, 10, 10]} intensity={0.4} color="#ffd700" />
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#ffd700" distance={30} />

      {/* Nebula/Core Sphere */}
      <mesh ref={coreRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial 
          color="#ffffff" 
          roughness={0.1}
          metalness={0.9}
          emissive="#ffd700" 
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Outer Halo Rings */}
      <mesh rotation={[Math.PI / 4, Math.PI / 6, 0]}>
        <torusGeometry args={[2.5, 0.05, 16, 100]} />
        <meshBasicMaterial color="#a020f0" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 3, Math.PI / 4, 0]}>
        <torusGeometry args={[3.2, 0.03, 16, 100]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.4} />
      </mesh>

      {/* Spiral Galaxy Particles */}
      <points ref={galaxyRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particleData.pos, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[particleData.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.1}
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Constellation Connecting Lines */}
      {linePoints.length > 1 && (
        <Line 
          points={linePoints}
          color="#ffd700"
          lineWidth={2.5}
          transparent
          opacity={0.85}
        />
      )}

      {/* Floating Constellation Stars */}
      {COSMIC_STARS.map((star, idx) => {
        const isVisited = visitedNodes.includes(idx);
        
        return (
          <Float key={idx} speed={1.5} rotationIntensity={0.5} floatIntensity={0.4}>
            <group position={star.pos}>
              {/* Star Mesh */}
              <mesh 
                onClick={() => handleStarClick(idx)}
                onPointerOver={(e) => {
                  document.body.style.cursor = 'pointer';
                  const mesh = e.object as THREE.Mesh;
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  mat.emissiveIntensity = 2.5;
                }}
                onPointerOut={(e) => {
                  document.body.style.cursor = 'default';
                  const mesh = e.object as THREE.Mesh;
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  mat.emissiveIntensity = isVisited ? 2.5 : 0.8;
                }}
              >
                <dodecahedronGeometry args={[0.5]} />
                <meshStandardMaterial 
                  color="#ffffff" 
                  emissive={isVisited ? "#ffd700" : "#a020f0"} 
                  emissiveIntensity={isVisited ? 2.5 : 0.8}
                  roughness={0.0}
                  metalness={1.0}
                />
              </mesh>

              {/* Orbiting Ring around Star */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.8, 0.02, 8, 32]} />
                <meshBasicMaterial 
                  color={isVisited ? "#ffd700" : "#a020f0"} 
                  transparent
                  opacity={isVisited ? 0.8 : 0.3}
                />
              </mesh>

              {/* Tag overlay */}
              <Html distanceFactor={12} position={[0, -1.0, 0]} center>
                <div style={{
                  background: 'rgba(7, 8, 20, 0.85)',
                  border: `1px solid ${isVisited ? '#ffd700' : 'rgba(160, 32, 240, 0.3)'}`,
                  boxShadow: isVisited ? '0 0 10px rgba(255, 215, 0, 0.4)' : 'none',
                  color: isVisited ? '#ffd700' : '#c3c7e0',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {star.label}
                </div>
              </Html>
            </group>
          </Float>
        );
      })}
    </group>
  );
};
export default CosmicScene;
