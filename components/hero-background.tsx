"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Volatility Surface Parameters
const GRID_SIZE = 80; // Number of points per side
const SURFACE_WIDTH = 20;
const SURFACE_DEPTH = 16;
const WAVE_SPEED = 0.3;
const BASE_AMPLITUDE = 1.2;

// Signal Green color
const SIGNAL_GREEN = "#00E676";

function VolatilitySurface() {
  const meshRef = useRef<THREE.LineSegments>(null);
  const timeRef = useRef(0);

  // Create the grid geometry for wireframe
  const { positions, indices } = useMemo(() => {
    const positions = new Float32Array(GRID_SIZE * GRID_SIZE * 3);
    const indices: number[] = [];

    // Create grid positions
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = (z * GRID_SIZE + x) * 3;
        positions[idx] = (x / (GRID_SIZE - 1) - 0.5) * SURFACE_WIDTH;
        positions[idx + 1] = 0; // Y will be animated
        positions[idx + 2] = (z / (GRID_SIZE - 1) - 0.5) * SURFACE_DEPTH;
      }
    }

    // Create line indices for wireframe grid
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const current = z * GRID_SIZE + x;

        // Horizontal lines (along X)
        if (x < GRID_SIZE - 1) {
          indices.push(current, current + 1);
        }

        // Vertical lines (along Z)
        if (z < GRID_SIZE - 1) {
          indices.push(current, current + GRID_SIZE);
        }
      }
    }

    return { positions, indices };
  }, []);

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

    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = (z * GRID_SIZE + x) * 3;
        const xPos = posArray[idx];
        const zPos = posArray[idx + 2];

        // Create multiple wave patterns for volatility surface effect
        // Primary wave - large undulations
        const wave1 = Math.sin(xPos * 0.3 + time) * Math.cos(zPos * 0.4 + time * 0.7) * BASE_AMPLITUDE;

        // Secondary wave - faster, smaller ripples (like market volatility)
        const wave2 = Math.sin(xPos * 0.8 + time * 2) * 0.3;

        // Tertiary wave - creates the "trading chart" peaks and valleys
        const wave3 = Math.sin(xPos * 0.15 + zPos * 0.1 + time * 0.5) * 0.8;

        // Random noise simulation for volatility spikes
        const noise = Math.sin(xPos * 2 + zPos * 3 + time * 3) * 0.15;

        // Edge fade - surface fades at edges
        const edgeFadeX = 1 - Math.pow(Math.abs(xPos) / (SURFACE_WIDTH / 2), 4);
        const edgeFadeZ = 1 - Math.pow(Math.abs(zPos) / (SURFACE_DEPTH / 2), 4);
        const edgeFade = edgeFadeX * edgeFadeZ;

        posArray[idx + 1] = (wave1 + wave2 + wave3 + noise) * edgeFade;
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
      args={[40, 40, SIGNAL_GREEN, SIGNAL_GREEN]}
      position={[0, -4, 0]}
      rotation={[0, 0, 0]}
      material-opacity={0.08}
      material-transparent={true}
    />
  );
}

// Floating data points around the surface
function DataPoints() {
  const pointsRef = useRef<THREE.Points>(null);
  const POINT_COUNT = 200;

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(POINT_COUNT * 3);
    const velocities = new Float32Array(POINT_COUNT * 3);

    for (let i = 0; i < POINT_COUNT; i++) {
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

    for (let i = 0; i < POINT_COUNT; i++) {
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
          args={[positions, 3]}
          count={POINT_COUNT}
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
      {/* Void black background */}
      <color attach="background" args={["#020202"]} />

      {/* Subtle ambient lighting */}
      <ambientLight intensity={0.3} />

      {/* Directional light for depth */}
      <directionalLight position={[5, 5, 5]} intensity={0.2} color={SIGNAL_GREEN} />

      {/* Main Volatility Surface */}
      <VolatilitySurface />

      {/* Subtle grid floor */}
      <GridFloor />

      {/* Floating data points */}
      <DataPoints />
    </>
  );
}

export function HeroBackground() {
  return (
    <div className="absolute inset-0 z-0">
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 2, 10], fov: 50 }}
        dpr={[1, 2]}
        style={{ background: "#020202" }}
        gl={{ antialias: true, alpha: false }}
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
