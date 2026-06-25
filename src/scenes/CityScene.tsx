import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import SynthEngine from '../audio/SynthEngine';

interface CitySceneProps {
  onNodeClick: (nodeIndex: number, text: string) => void;
  isMicActive: boolean;
  micVolume: number;
}

const RHYTHM_NODES = [
  { note: 69, vowel: 'o' as const, label: 'Ignite Beat', text: 'A deep electronic kick started thumping. Aria felt her heart syncing with the city.' },
  { note: 71, vowel: 'i' as const, label: 'Neon Glow', text: 'High-hats sparkled like the streetlamps. Aria\'s vocal oscillator gained resonance.' },
  { note: 72, vowel: 'u' as const, label: 'Pulse Frequency', text: 'Snare drums cracked through the static. Rhythm and vocal formants locked in harmony.' },
  { note: 76, vowel: 'a' as const, label: 'Sonic Surge', text: 'With the city fully powered, Aria restored her rhythmic soul. The final portal was opening...' }
];

export const CityScene: React.FC<CitySceneProps> = ({ onNodeClick, isMicActive, micVolume }) => {
  const synth = SynthEngine.getInstance();
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const eqGroupRef = useRef<THREE.Group>(null);
  const floorRef = useRef<THREE.Mesh>(null);
  
  // Frequency data array (higher size for fine-grained equalizer towers)
  const freqData = useRef(new Uint8Array(256));

  const handlePadClick = (idx: number) => {
    setActiveNode(idx);
    const node = RHYTHM_NODES[idx];
    
    // Play electronic synth vocals and slide pitches
    synth.setVocalVowel(node.vowel);
    synth.startSinging(node.note);

    // Update narration callback
    onNodeClick(idx, node.text);
  };

  // Generate 24 equalizer tower positions in a circle
  const numTowers = 24;
  const towers = React.useMemo(() => {
    const list = [];
    const radius = 6;
    for (let i = 0; i < numTowers; i++) {
      const angle = (i / numTowers) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      list.push({ x, z, angle });
    }
    return list;
  }, [numTowers]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Get frequency data from SynthEngine
    if (synth.analyser) {
      synth.analyser.getByteFrequencyData(freqData.current);
    }

    // Scale the equalizer towers based on audio frequencies
    if (eqGroupRef.current) {
      eqGroupRef.current.children.forEach((mesh, idx) => {
        // Map tower index to frequency bins
        const bin = Math.floor((idx / numTowers) * 60) + 2; // skip sub-bass
        const freqVal = freqData.current[bin] || 0;
        
        // Target scale Y (height)
        const micBoost = isMicActive ? micVolume * 8 : 0;
        const targetScaleY = 0.2 + (freqVal / 255) * 5.5 + micBoost;
        
        // Smooth interpolation (lerp)
        mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, targetScaleY, 0.25);
        mesh.position.y = -2 + mesh.scale.y / 2; // keep anchor at the bottom

        // Modulate tower colors based on amplitude
        const mat = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.emissiveIntensity = 0.4 + (freqVal / 255) * 1.5;
        }
      });
    }

    // Ripple floor emissive glow
    if (floorRef.current) {
      const mat = floorRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        let avg = 0;
        for (let i = 0; i < 20; i++) avg += freqData.current[i];
        avg /= 20;
        mat.emissiveIntensity = 0.1 + (avg / 255) * 0.4 + Math.sin(time * 3.0) * 0.05;
      }
    }
  });

  return (
    <group>
      {/* City Atmosphere Lights */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[-8, 12, -8]} intensity={0.5} color="#ff007a" />
      <directionalLight position={[8, 12, 8]} intensity={0.8} color="#00f0ff" />
      
      {/* Cyan/Pink key light at the center */}
      <pointLight position={[0, 4, 0]} intensity={1.8} color="#00f0ff" distance={15} />

      {/* Cyberpunk Ground */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial 
          color="#060c14" 
          roughness={0.9} 
          metalness={0.8} 
          emissive="#ff004c" 
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Futuristic neon grid helper */}
      <gridHelper args={[80, 40, '#ff007a', '#004a5c']} position={[0, -2, 0]} />

      {/* Graphic Equalizer Towers */}
      <group ref={eqGroupRef}>
        {towers.map((tower, idx) => {
          // Alternative colors for towers (cyan vs magenta)
          const isEven = idx % 2 === 0;
          const color = isEven ? '#00f0ff' : '#ff007a';
          
          return (
            <mesh 
              key={idx} 
              position={[tower.x, -2, tower.z]} 
              rotation={[0, -tower.angle, 0]}
            >
              <boxGeometry args={[0.5, 1.0, 0.5]} />
              <meshStandardMaterial 
                color="#0c182b" 
                roughness={0.2}
                metalness={0.8}
                emissive={color}
                emissiveIntensity={0.5}
              />
            </mesh>
          );
        })}
      </group>

      {/* Floating Interactive Rhythm Drums/Pads */}
      {RHYTHM_NODES.map((node, idx) => {
        const radius = 3.2;
        // Position pads in a tighter inner ring
        const angle = (idx / RHYTHM_NODES.length) * Math.PI * 2 + Math.PI / 4;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const isActive = activeNode === idx;

        return (
          <Float key={idx} speed={2.5} rotationIntensity={0.4} floatIntensity={0.3}>
            <group position={[x, -0.4, z]}>
              {/* Interactive drum pad cylindrical mesh */}
              <mesh 
                rotation={[0.2, 0, 0]}
                onClick={() => handlePadClick(idx)}
                onPointerOver={(e) => {
                  document.body.style.cursor = 'pointer';
                  const mesh = e.object as THREE.Mesh;
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  mat.emissiveIntensity = 2.0;
                }}
                onPointerOut={(e) => {
                  document.body.style.cursor = 'default';
                  const mesh = e.object as THREE.Mesh;
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  mat.emissiveIntensity = isActive ? 2.5 : 0.8;
                }}
              >
                <cylinderGeometry args={[0.6, 0.6, 0.25, 16]} />
                <meshStandardMaterial 
                  color="#ffffff" 
                  emissive={isActive ? "#00f0ff" : "#ff007a"} 
                  emissiveIntensity={isActive ? 2.5 : 0.8}
                  roughness={0.05}
                  metalness={0.9}
                />
              </mesh>

              {/* Glowing ring under each drum */}
              <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.9, 0.03, 8, 32]} />
                <meshBasicMaterial 
                  color={isActive ? "#ff007a" : "#00f0ff"} 
                  transparent
                  opacity={isActive ? 0.9 : 0.3}
                />
              </mesh>

              {/* Floating Name Label */}
              <Html distanceFactor={10} position={[0, -1.0, 0]} center>
                <div style={{
                  background: 'rgba(7, 8, 20, 0.85)',
                  border: `1px solid ${isActive ? '#ff007a' : '#00f0ff'}`,
                  boxShadow: isActive ? '0 0 10px rgba(255, 0, 122, 0.3)' : '0 0 10px rgba(0, 240, 255, 0.1)',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {node.label}
                </div>
              </Html>
            </group>
          </Float>
        );
      })}
    </group>
  );
};
export default CityScene;
