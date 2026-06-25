import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import SynthEngine from '../audio/SynthEngine';

interface MeadowSceneProps {
  onNodeClick: (nodeIndex: number, text: string) => void;
  isMicActive: boolean;
  micVolume: number;
}

const NODES_DATA = [
  { note: 57, vowel: 'a' as const, label: 'Whisper of Hope', text: 'Aria felt a faint vibration in the roots. The meadow remembered her voice.' },
  { note: 60, vowel: 'o' as const, label: 'Echo of the Past', text: 'A gentle hum echoed from the bark. "The song is hidden within the wind," it whispered.' },
  { note: 62, vowel: 'i' as const, label: 'Breath of Life', text: 'As the light shimmered, the ancient tree rustled, releasing its pollen of melody.' },
  { note: 64, vowel: 'u' as const, label: 'Flowing Stream', text: 'A stream of pure tone trickled through the soil, carrying away Aria\'s silence.' },
  { note: 67, vowel: 'a' as const, label: 'First Harmony', text: 'Melody was restored. But the pulse of rhythm was still missing in the distance...' }
];

export const MeadowScene: React.FC<MeadowSceneProps> = ({ onNodeClick, isMicActive, micVolume }) => {
  const synth = SynthEngine.getInstance();
  const treeRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  
  // Frequency data container
  const freqData = useRef(new Uint8Array(128));

  // Handle crystal interaction
  const handleCrystalClick = (idx: number) => {
    setActiveNode(idx);
    const node = NODES_DATA[idx];
    
    // Web Audio interaction
    synth.setVocalVowel(node.vowel);
    synth.startSinging(node.note);
    
    // Callback to update HUD
    onNodeClick(idx, node.text);
  };

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Get frequency data from SynthEngine
    let avgFreq = 0;
    if (synth.analyser) {
      synth.analyser.getByteFrequencyData(freqData.current);
      let sum = 0;
      for (let i = 0; i < freqData.current.length; i++) {
        sum += freqData.current[i];
      }
      avgFreq = sum / freqData.current.length; // 0 to 255
    }

    // Add microphone modulation if active
    const soundScale = 1.0 + (avgFreq / 150) + (isMicActive ? micVolume * 1.5 : 0);

    // Rotate/sway the tree gently
    if (treeRef.current) {
      treeRef.current.rotation.y = Math.sin(time * 0.3) * 0.05;
      treeRef.current.rotation.z = Math.cos(time * 0.45) * 0.03;
      
      // Pulse foliage based on music volume
      const foliageGroup = treeRef.current.children[1];
      if (foliageGroup) {
        foliageGroup.scale.setScalar(1.0 + (avgFreq / 400) * 0.15);
      }
    }

    // Drifting particles (pollen)
    if (particlesRef.current) {
      particlesRef.current.rotation.y = time * 0.02;
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        // Sway particles on X/Z coordinates
        positions[i] += Math.sin(time + i) * 0.002;
        positions[i + 2] += Math.cos(time + i) * 0.002;
        
        // Wrap-around height Y
        if (positions[i + 1] > 10) {
          positions[i + 1] = -5;
        } else {
          positions[i + 1] += 0.005 * soundScale; // drift faster with music
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Ground shimmer
    if (groundRef.current) {
      const mat = groundRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.15 + Math.sin(time * 1.5) * 0.05 + (avgFreq / 255) * 0.2;
      }
    }
  });

  // Particle positions generator
  const particleCount = 200;
  const particlePositions = React.useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 35; // X
      pos[i + 1] = Math.random() * 15 - 5; // Y
      pos[i + 2] = (Math.random() - 0.5) * 35; // Z
    }
    return pos;
  }, []);

  return (
    <group>
      {/* Lights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} color="#00f3a6" />
      <pointLight position={[0, 4, 0]} intensity={1.5} color="#00f3a6" distance={20} />

      {/* Styled Ground Plane */}
      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[100, 100, 32, 32]} />
        <meshStandardMaterial 
          color="#061c16" 
          roughness={0.8} 
          metalness={0.2} 
          emissive="#005439" 
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Grid Helper styled as neon roots */}
      <gridHelper args={[80, 40, '#00f3a6', '#033b28']} position={[0, -1.98, 0]} />

      {/* Ancient Tree representation */}
      <group ref={treeRef} position={[0, -2, 0]}>
        {/* Trunk */}
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[0.3, 0.8, 6, 8]} />
          <meshStandardMaterial color="#0e231e" roughness={0.9} />
        </mesh>
        
        {/* Glowing Foliage */}
        <group position={[0, 6, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[1.8, 16, 16]} />
            <meshStandardMaterial color="#008c5e" emissive="#00f3a6" emissiveIntensity={0.6} roughness={0.7} />
          </mesh>
          <mesh position={[1.5, -0.8, 1.2]}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial color="#007a52" emissive="#00f3a6" emissiveIntensity={0.4} roughness={0.7} />
          </mesh>
          <mesh position={[-1.4, -0.5, -1.5]}>
            <sphereGeometry args={[1.3, 16, 16]} />
            <meshStandardMaterial color="#007a52" emissive="#00f3a6" emissiveIntensity={0.4} roughness={0.7} />
          </mesh>
        </group>
      </group>

      {/* Drifting Pollen Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          color="#00f3a6"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Floating Crystals / Interactive Sound Nodes */}
      {NODES_DATA.map((node, idx) => {
        const angle = (idx / NODES_DATA.length) * Math.PI * 2;
        const radius = 8;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const y = 1.0 + Math.sin(idx * 2) * 0.8;
        const isActive = activeNode === idx;

        return (
          <Float key={idx} speed={1.8} rotationIntensity={0.6} floatIntensity={0.5}>
            <group position={[x, y, z]}>
              {/* Glowing Interactive Crystal */}
              <mesh 
                onClick={() => handleCrystalClick(idx)}
                onPointerOver={(e) => {
                  document.body.style.cursor = 'pointer';
                  // subtle hover visual
                  const mesh = e.object as THREE.Mesh;
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  mat.emissiveIntensity = 1.5;
                }}
                onPointerOut={(e) => {
                  document.body.style.cursor = 'default';
                  const mesh = e.object as THREE.Mesh;
                  const mat = mesh.material as THREE.MeshStandardMaterial;
                  mat.emissiveIntensity = isActive ? 1.8 : 0.7;
                }}
              >
                <octahedronGeometry args={[0.7]} />
                <meshStandardMaterial 
                  color="#ffffff" 
                  emissive={isActive ? "#00f3a6" : "#00aa74"} 
                  emissiveIntensity={isActive ? 1.8 : 0.7}
                  roughness={0.1}
                  metalness={0.9}
                />
              </mesh>
              
              {/* Outer floating orbit ring for visual feedback */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[1.2, 0.02, 8, 32]} />
                <meshBasicMaterial 
                  color={isActive ? "#00f3a6" : "#005a3e"} 
                  transparent 
                  opacity={isActive ? 0.8 : 0.3} 
                />
              </mesh>

              {/* 3D Floating Tag HTML */}
              <Html distanceFactor={12} position={[0, -1.3, 0]} center>
                <div style={{
                  background: 'rgba(7, 8, 20, 0.85)',
                  border: `1px solid ${isActive ? '#00f3a6' : 'rgba(255,255,255,0.08)'}`,
                  color: isActive ? '#00f3a6' : '#a0a5c4',
                  boxShadow: isActive ? '0 0 10px rgba(0, 243, 166, 0.3)' : 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '11px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {node.label} ({node.vowel.toUpperCase()})
                </div>
              </Html>
            </group>
          </Float>
        );
      })}
    </group>
  );
};
export default MeadowScene;
