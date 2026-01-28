"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 3000;
const WAVE_SPEED = 0.15;
const WAVE_AMPLITUDE = 0.8;
const WAVE_FREQUENCY = 0.4;

// Colors - Platinum & Signal Green
const SIGNAL_GREEN = new THREE.Color("#00E676");
const PLATINUM = new THREE.Color("#E5E4E2");

function ParticleWave() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  // Create particle positions and properties
  const { positions, scales, colorMix } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const colorMix = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spread particles in a wide field
      positions[i * 3] = (Math.random() - 0.5) * 25; // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12; // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5; // z (pushed back)

      // Random scale for depth variation
      scales[i] = Math.random() * 0.8 + 0.2;

      // Random color mix (0 = emerald, 1 = gold)
      colorMix[i] = Math.random();
    }

    return { positions, scales, colorMix };
  }, []);

  // Pre-create objects for animation
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta * WAVE_SPEED;
    const time = timeRef.current;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const baseX = positions[i * 3];
      const baseY = positions[i * 3 + 1];
      const baseZ = positions[i * 3 + 2];
      const scale = scales[i];
      const mix = colorMix[i];

      // Create flowing wave motion
      const waveX = Math.sin(baseY * WAVE_FREQUENCY + time) * WAVE_AMPLITUDE;
      const waveY = Math.sin(baseX * WAVE_FREQUENCY * 0.8 + time * 1.2) * WAVE_AMPLITUDE * 0.5;
      const waveZ = Math.cos(baseX * WAVE_FREQUENCY * 0.5 + baseY * WAVE_FREQUENCY * 0.3 + time * 0.8) * WAVE_AMPLITUDE * 0.3;

      // Apply position with wave offset
      dummy.position.set(
        baseX + waveX,
        baseY + waveY,
        baseZ + waveZ
      );

      // Gentle rotation based on position
      dummy.rotation.z = Math.sin(time + baseX * 0.1) * 0.5;

      // Pulsing scale
      const pulseScale = scale * (0.8 + Math.sin(time * 2 + i * 0.01) * 0.2);
      dummy.scale.setScalar(pulseScale * 0.03);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Interpolate between signal green and platinum based on mix value
      // Add time-based color shifting for shimmer effect
      const shiftedMix = (mix + Math.sin(time * 0.5 + i * 0.005) * 0.15 + 1) % 1;
      color.copy(SIGNAL_GREEN).lerp(PLATINUM, shiftedMix);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.7} />
    </instancedMesh>
  );
}

function Scene() {
  return (
    <>
      {/* Deep void background */}
      <color attach="background" args={["#020617"]} />

      {/* Subtle ambient lighting */}
      <ambientLight intensity={0.5} />

      {/* Particle wave system */}
      <ParticleWave />
    </>
  );
}

export function HeroBackground() {
  return (
    <div className="absolute inset-0 z-0">
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        style={{ background: "#020617" }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene />
      </Canvas>

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(2, 6, 23, 0.4) 70%, rgba(2, 6, 23, 0.8) 100%)`,
        }}
      />

      {/* Radial gradient for text readability - center glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0, 230, 118, 0.08) 0%, transparent 50%)`,
        }}
      />

      {/* Top fade for navbar */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(2, 6, 23, 0.6) 0%, transparent 100%)`,
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(5, 5, 5, 1) 0%, rgba(5, 5, 5, 0.8) 30%, transparent 100%)`,
        }}
      />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
