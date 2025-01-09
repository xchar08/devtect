import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Utility function to generate random colors
const getRandomColor = () => {
  const colors = [
    "#FF5733", "#33FF57", "#3357FF", "#F333FF",
    "#FF33A8", "#33FFF3", "#A833FF", "#FF8F33",
    "#33FF8F", "#8F33FF", "#FF3333", "#33FFBD",
    "#FFBD33", "#BD33FF", "#33BDFF"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

function GlobbedD() {
  const groupRef = useRef();

  // Rotate the group about the Z-axis
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.01; // Rotate around Z-axis
    }
  });

  // Helper to generate spheres for the "D"
  const createGlobbedD = () => {
    const spheres = [];
    const radius = 1.5;
    const sphereRadius = 0.5;
    const semiCircleSegments = 6;
    const stemOffset = 0.4;

    // Semi-circular curve of the "D"
    for (let i = 0; i <= 180; i += Math.floor(180 / semiCircleSegments)) {
      const theta = THREE.MathUtils.degToRad(i + 90);
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);

      for (let j = -1; j <= 1; j += 1) {
        spheres.push({
          position: [
            x + (Math.random() * 0.2 - 0.1),
            y + (Math.random() * 0.2 - 0.1),
            j * 0.2 + (Math.random() * 0.1)
          ],
          color: getRandomColor(),
          scale: 0.8 + Math.random() * 0.4
        });
      }
    }

    // Vertical stem
    const verticalHeight = 3;
    const verticalSpacing = 0.3;
    const verticalSpheresCount = Math.ceil(verticalHeight / verticalSpacing);

    for (let i = 0; i < verticalSpheresCount; i++) {
      const y = -verticalHeight / 2 + i * verticalSpacing;
      spheres.push({
        position: [
          stemOffset + (Math.random() * 0.2 - 0.1),
          y + (Math.random() * 0.1 - 0.05),
          Math.random() * 0.2 - 0.1
        ],
        color: getRandomColor(),
        scale: 0.6 + Math.random() * 0.4
      });
    }

    return spheres.map((sphere, i) => (
      <mesh key={i} position={sphere.position} scale={[sphere.scale, sphere.scale, sphere.scale]}>
        <sphereGeometry args={[sphereRadius, 32, 32]} />
        <meshStandardMaterial color={sphere.color} />
      </mesh>
    ));
  };

  return (
    <group ref={groupRef} scale={[-1, 1, 1]}>
      {createGlobbedD()}
    </group>
  );
}

function RotatingD() {
  return (
    <Canvas
      style={{
        width: "120%",
        height: "800px",
      }}
      camera={{ position: [0, 0, 7], fov: 60 }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <GlobbedD />
      <OrbitControls enableZoom={true} />
    </Canvas>
  );
}

export default RotatingD;
