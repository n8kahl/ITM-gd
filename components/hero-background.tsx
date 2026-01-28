"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Optimized Parameters - Reduced for better performance
const GRID_SIZE_DESKTOP = 50; // Reduced from 80
const GRID_SIZE_MOBILE = 30; // Even smaller for mobile (if ever used)
const SURFACE_WIDTH = 20;
const SURFACE_DEPTH = 16;
const WAVE_SPEED = 0.3;
const BASE_AMPLITUDE = 1.2;
const POINT_COUNT_DESKTOP = 100; // Reduced from 200

// Signal Green color
const SIGNAL_GREEN = "#00E676";

// Mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

function VolatilitySurface() {
  const meshRef = useRef<THREE.LineSegments>(null);
  const timeRef = useRef(0);
  const gridSize = GRID_SIZE_DESKTOP;

  // Create the grid geometry for wireframe
  const { positions, indices } = useMemo(() => {
    const positions = new Float32Array(gridSize * gridSize * 3);
    const indices: number[] = [];

    // Create grid positions
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = (z * gridSize + x) * 3;
        positions[idx] = (x / (gridSize - 1) - 0.5) * SURFACE_WIDTH;
        positions[idx + 1] = 0;
        positions[idx + 2] = (z / (gridSize - 1) - 0.5) * SURFACE_DEPTH;
      }
    }

    // Create line indices for wireframe grid - skip every other line for performance
    for (let z = 0; z < gridSize; z += 2) {
      for (let x = 0; x < gridSize; x++) {
        const current = z * gridSize + x;

        // Horizontal lines (along X)
        if (x < gridSize - 1) {
          indices.push(current, current + 1);
        }

        // Vertical lines (along Z) - only every other
        if (z < gridSize - 2) {
          indices.push(current, current + gridSize * 2);
        }
      }
    }

    return { positions, indices };
  }, [gridSize]);

  // Create buffer geometry
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }, [positions, indices]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta * WAVE_SPEED;
    const time = timeRef.current;

    const positionAttribute = meshRef.current.geometry.getAttribute("position");
    const posArray = positionAttribute.array as Float32Array;

    // Optimized loop - process fewer calculations
    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = (z * gridSize + x) * 3;
        const xPos = posArray[idx];
        const zPos = posArray[idx + 2];

        // Simplified wave calculations (reduced from 4 to 2 waves)
        const wave1 = Math.sin(xPos * 0.3 + time) * Math.cos(zPos * 0.4 + time * 0.7) * BASE_AMPLITUDE;
        const wave2 = Math.sin(xPos * 0.15 + zPos * 0.1 + time * 0.5) * 0.8;

        // Edge fade
        const edgeFadeX = 1 - Math.pow(Math.abs(xPos) / (SURFACE_WIDTH / 2), 4);
        const edgeFadeZ = 1 - Math.pow(Math.abs(zPos) / (SURFACE_DEPTH / 2), 4);
        const edgeFade = edgeFadeX * edgeFadeZ;

        posArray[idx + 1] = (wave1 + wave2) * edgeFade;
      }
    }

    positionAttribute.needsUpdate = true;
  });

  return (
    <lineSegments ref={meshRef} geometry={geometry} rotation={[-Math.PI / 4, 0, 0]} position={[0, -1, -2]}>
      <lineBasicMaterial
        color={SIGNAL_GREEN}
        transparent
        opacity={0.6}
        linewidth={1}
      />
    </lineSegments>
  );
}

// Subtle grid floor for depth
function GridFloor() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.z = (state.clock.elapsedTime * 0.5) % 1;
    }
  });

  return (
    <gridHelper
      ref={gridRef}
      args={[40, 20, SIGNAL_GREEN, SIGNAL_GREEN]} // Reduced from 40 divisions to 20
      position={[0, -4, 0]}
      rotation={[0, 0, 0]}
      material-opacity={0.08}
      material-transparent={true}
    />
  );
}

// Floating data points - reduced count
function DataPoints() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(POINT_COUNT_DESKTOP * 3);
    const velocities = new Float32Array(POINT_COUNT_DESKTOP * 3);

    for (let i = 0; i < POINT_COUNT_DESKTOP; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;

      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.015;
    }

    return { positions, velocities };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;

    const positionAttribute = pointsRef.current.geometry.getAttribute("position");
    const posArray = positionAttribute.array as Float32Array;

    for (let i = 0; i < POINT_COUNT_DESKTOP; i++) {
      posArray[i * 3] += velocities[i * 3];
      posArray[i * 3 + 1] += velocities[i * 3 + 1];
      posArray[i * 3 + 2] += velocities[i * 3 + 2];

      // Wrap around
      if (Math.abs(posArray[i * 3]) > 10) velocities[i * 3] *= -1;
      if (Math.abs(posArray[i * 3 + 1]) > 5) velocities[i * 3 + 1] *= -1;
      if (Math.abs(posArray[i * 3 + 2]) > 6) velocities[i * 3 + 2] *= -1;
    }

    positionAttribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={POINT_COUNT_DESKTOP}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={SIGNAL_GREEN}
        size={0.03}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={["#020202"]} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.2} color={SIGNAL_GREEN} />
      <VolatilitySurface />
      <GridFloor />
      <DataPoints />
    </>
  );
}

// Static mobile background - no Three.js, pure CSS
function MobileBackground() {
  return (
    <div className="absolute inset-0 z-0 bg-[#020202]">
      {/* Static gradient that mimics the 3D effect */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0, 230, 118, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 30% 60%, rgba(0, 230, 118, 0.05) 0%, transparent 40%),
            radial-gradient(ellipse 50% 30% at 70% 30%, rgba(0, 230, 118, 0.04) 0%, transparent 35%)
          `,
        }}
      />

      {/* Static grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 230, 118, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 230, 118, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 230, 118, 0.1) 2px,
            rgba(0, 230, 118, 0.1) 4px
          )`,
        }}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(2, 2, 2, 0.5) 70%, rgba(2, 2, 2, 0.9) 100%)`,
        }}
      />

      {/* Top fade for navbar */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(2, 2, 2, 0.8) 0%, transparent 100%)`,
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(2, 2, 2, 1) 0%, rgba(2, 2, 2, 0.8) 30%, transparent 100%)`,
        }}
      />
    </div>
  );
}

export function HeroBackground() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Server-side and initial render - show nothing to prevent hydration mismatch
  if (!mounted) {
    return <div className="absolute inset-0 z-0 bg-[#020202]" />;
  }

  // Mobile devices get static background - no GPU-heavy Three.js
  if (isMobile) {
    return <MobileBackground />;
  }

  // Desktop gets the full Three.js experience
  return (
    <div className="absolute inset-0 z-0">
      {/* Three.js Canvas - Desktop only */}
      <Canvas
        camera={{ position: [0, 2, 10], fov: 50 }}
        dpr={[1, 1.5]} // Reduced max DPR from 2 to 1.5
        style={{ background: "#020202" }}
        gl={{
          antialias: false, // Disable antialiasing for performance
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <Scene />
      </Canvas>

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 230, 118, 0.1) 2px,
            rgba(0, 230, 118, 0.1) 4px
          )`,
        }}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, transparent 30%, rgba(2, 2, 2, 0.5) 70%, rgba(2, 2, 2, 0.9) 100%)`,
        }}
      />

      {/* Center glow for text readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0, 230, 118, 0.05) 0%, transparent 50%)`,
        }}
      />

      {/* Top fade for navbar */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(2, 2, 2, 0.8) 0%, transparent 100%)`,
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(2, 2, 2, 1) 0%, rgba(2, 2, 2, 0.8) 30%, transparent 100%)`,
        }}
      />

      {/* Grid overlay for HUD feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 230, 118, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 230, 118, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  );
}
