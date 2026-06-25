import React, { useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import MeadowScene from '../scenes/MeadowScene';
import CityScene from '../scenes/CityScene';
import CosmicScene from '../scenes/CosmicScene';

interface ExperienceCanvasProps {
  chapter: 1 | 2 | 3;
  onNodeClick: (nodeIndex: number, text: string) => void;
  isMicActive: boolean;
  micVolume: number;
  micPitch: number;
  onClimax: () => void;
}

// Subcomponent to animate camera shifts smoothly when chapters change
const CameraController: React.FC<{ chapter: 1 | 2 | 3 }> = ({ chapter }) => {
  const { camera } = useThree();
  
  const targetPosition = useRef(new THREE.Vector3(0, 4, 14));
  const targetLookAt = useRef(new THREE.Vector3(0, 1, 0));

  useEffect(() => {
    // Cinematic camera positions for different scenes
    if (chapter === 1) {
      targetPosition.current.set(0, 4, 14);
      targetLookAt.current.set(0, 2, 0);
    } else if (chapter === 2) {
      targetPosition.current.set(0, 3, 11);
      targetLookAt.current.set(0, 1.5, 0);
    } else {
      targetPosition.current.set(0, 2, 12);
      targetLookAt.current.set(0, 0, 0);
    }
  }, [chapter]);

  useFrame(() => {
    // Lerp camera position
    camera.position.lerp(targetPosition.current, 0.04);
    
    // Look at target lerp
    camera.lookAt(targetLookAt.current);
  });

  return null;
};

export const ExperienceCanvas: React.FC<ExperienceCanvasProps> = ({
  chapter,
  onNodeClick,
  isMicActive,
  micVolume,
  micPitch,
  onClimax
}) => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 2 }}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 4, 14], fov: 55 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#070814'));
        }}
      >
        <CameraController chapter={chapter} />

        {/* Orbit Controls (constrained so the user cannot flip upside down or clip under floor) */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.05} // don't go under floor
          minDistance={5}
          maxDistance={25}
        />

        {/* Dynamic Scene Selector */}
        {chapter === 1 && (
          <MeadowScene 
            onNodeClick={onNodeClick} 
            isMicActive={isMicActive} 
            micVolume={micVolume} 
          />
        )}
        
        {chapter === 2 && (
          <CityScene 
            onNodeClick={onNodeClick} 
            isMicActive={isMicActive} 
            micVolume={micVolume} 
          />
        )}
        
        {chapter === 3 && (
          <CosmicScene 
            onNodeClick={onNodeClick} 
            isMicActive={isMicActive} 
            micVolume={micVolume} 
            micPitch={micPitch}
            onClimax={onClimax}
          />
        )}
      </Canvas>
    </div>
  );
};
export default ExperienceCanvas;
