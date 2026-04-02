"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line, Billboard } from "@react-three/drei";
import * as THREE from "three";

interface TextWalkStep {
  wordIndex: number;
  word: string;
  textPosition: number;
  coords: [number, number, number];
  nearby: Array<{ word: string; similarity: number; coordIdx: number }>;
}

interface WordPoint {
  word: string;
  coords: [number, number, number];
  frequency: number;
}

interface TextWalkSceneProps {
  steps: TextWalkStep[];
  wordPoints: WordPoint[];
  walking: boolean;
  firstPerson: boolean;
  progress: number;
  onProgressChange: (p: number) => void;
  isDark: boolean;
  trailColor: string;
}

function scaleCoords(coords: [number, number, number], scale = 8): [number, number, number] {
  return [coords[0] * scale, coords[1] * scale, coords[2] * scale];
}

// The walking particle
function Particle({ position, color }: { position: [number, number, number]; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(...position);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  );
}

// First-person camera follower
function CameraFollower({ target, lookAt, active }: {
  target: [number, number, number];
  lookAt: [number, number, number];
  active: boolean;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (!active) return;
    camera.position.lerp(new THREE.Vector3(...target), 0.1);
    const lookTarget = new THREE.Vector3(...lookAt);
    const currentLook = new THREE.Vector3();
    camera.getWorldDirection(currentLook);
    currentLook.add(camera.position);
    currentLook.lerp(lookTarget, 0.1);
    camera.lookAt(currentLook);
  });

  return null;
}

// Trail behind the particle — fades from soft to bright using the selected trail colour
function Trail({ points, baseColor }: { points: [number, number, number][]; baseColor: string }) {
  if (points.length < 2) return null;

  // Parse the base colour to RGB components
  const base = new THREE.Color(baseColor);
  const br = Math.round(base.r * 255);
  const bg = Math.round(base.g * 255);
  const bb = Math.round(base.b * 255);

  const totalSegs = points.length - 1;
  const segments = [];

  for (let i = 0; i < totalSegs; i++) {
    const age = (totalSegs - i) / totalSegs; // 1 = oldest, 0 = newest
    const opacity = 0.15 + (1 - age) * 0.7;
    // Fade: old segments are desaturated/lighter, new segments are full colour
    const r = Math.round(br - age * Math.min(br * 0.35, 80));
    const g = Math.round(bg - age * Math.min(bg * 0.35, 40));
    const b = Math.round(bb - age * Math.min(bb * 0.35, 20));
    const color = `rgb(${Math.max(0, r)},${Math.max(0, g)},${Math.max(0, b)})`;

    segments.push(
      <Line
        key={i}
        points={[points[i], points[i + 1]]}
        color={color}
        lineWidth={Math.max(1, 3 - age * 2)}
        transparent
        opacity={opacity}
      />
    );
  }

  return <>{segments}</>;
}

// Word dot in the cloud — smoothly animated via useFrame lerping
function WordDot({ position, label, isCurrent, isNearby, rank, frequency, maxFreq, isDark, currentColor }: {
  position: [number, number, number];
  label: string;
  isCurrent: boolean;
  isNearby: boolean;
  rank: number;
  frequency: number;
  maxFreq: number;
  isDark: boolean;
  currentColor: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const freqScale = Math.min(frequency / Math.max(maxFreq, 1), 1);

  // Target values
  const targetSize = isCurrent ? 0.12 : isNearby ? Math.max(0.04, 0.09 - rank * 0.006) : 0.02 + freqScale * 0.03;
  const targetOpacity = isCurrent ? 1 : isNearby ? 0.9 : 0.15 + freqScale * 0.2;
  const targetEmissive = isCurrent ? 0.8 : isNearby ? 0.4 : 0;

  const targetColor = useMemo(() => {
    if (isCurrent) return new THREE.Color(currentColor);
    if (isNearby) return new THREE.Color("#d4a017");
    return new THREE.Color(isDark ? "#555566" : "#bbb0a5");
  }, [isCurrent, isNearby, isDark, currentColor]);

  const targetEmissiveColor = useMemo(() => {
    if (isCurrent) return new THREE.Color(currentColor);
    if (isNearby) return new THREE.Color("#d4a017");
    return new THREE.Color("#000000");
  }, [isCurrent, isNearby, currentColor]);

  // Smoothly lerp material properties every frame
  useFrame(() => {
    if (matRef.current) {
      matRef.current.color.lerp(targetColor, 0.12);
      matRef.current.emissive.lerp(targetEmissiveColor, 0.12);
      matRef.current.emissiveIntensity += (targetEmissive - matRef.current.emissiveIntensity) * 0.12;
      matRef.current.opacity += (targetOpacity - matRef.current.opacity) * 0.12;
    }
    if (meshRef.current) {
      const s = meshRef.current.scale.x;
      const ratio = targetSize / 0.06; // scale relative to base geometry size
      const newS = s + (ratio - s) * 0.12;
      meshRef.current.scale.setScalar(newS);
    }
  });

  const fontSize = isCurrent ? 0.1 : isNearby ? Math.max(0.06, 0.1 - rank * 0.006) : 0.035 + freqScale * 0.015;
  const textColor = isCurrent
    ? currentColor
    : isNearby
      ? (isDark ? "#f0e8d0" : "#3a3020")
      : (isDark ? "#666677" : "#aaa099");

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color={isDark ? "#555566" : "#bbb0a5"}
          emissive="#000000"
          emissiveIntensity={0}
          transparent
          opacity={0.15}
        />
      </mesh>
      <Billboard position={[0, targetSize + 0.03, 0]}>
        <Text
          fontSize={fontSize}
          color={textColor}
          anchorX="center"
          anchorY="bottom"
          fillOpacity={isCurrent ? 1 : isNearby ? 1 : 0.45}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

// Connecting lines from particle to nearby words
function NearbyLines({ from, tos, color }: {
  from: [number, number, number];
  tos: [number, number, number][];
  color: string;
}) {
  return (
    <>
      {tos.map((to, i) => (
        <Line
          key={i}
          points={[from, to]}
          color={color}
          lineWidth={1}
          transparent
          opacity={0.3}
        />
      ))}
    </>
  );
}

function Scene({ steps, wordPoints, walking, firstPerson, progress, isDark, rideDistance, trailColor }: Omit<TextWalkSceneProps, "onProgressChange"> & { rideDistance: number }) {
  const currentStep = steps[progress] || steps[0];
  const nearby = currentStep?.nearby || [];
  const nearbySet = new Set(nearby.map(n => n.coordIdx));

  const scaledWords = useMemo(() => wordPoints.map(w => scaleCoords(w.coords)), [wordPoints]);
  const maxFreq = useMemo(() => Math.max(...wordPoints.map(w => w.frequency)), [wordPoints]);

  const currentScaled = scaledWords[currentStep.wordIndex];

  // Build trail: sequence of positions the particle has visited
  const trailPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= progress; i++) {
      const step = steps[i];
      if (step) pts.push(scaledWords[step.wordIndex]);
    }
    return pts;
  }, [progress, steps, scaledWords]);

  // Camera target for first-person: behind particle, looking forward
  const nextStep = steps[Math.min(progress + 1, steps.length - 1)];
  const nextScaled = scaledWords[nextStep.wordIndex];
  const dx = nextScaled[0] - currentScaled[0];
  const dy = nextScaled[1] - currentScaled[1];
  const dz = nextScaled[2] - currentScaled[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
  const cameraTarget: [number, number, number] = [
    currentScaled[0] - (dx / len) * rideDistance,
    currentScaled[1] - (dy / len) * rideDistance,
    currentScaled[2] + rideDistance * 0.3,
  ];
  const cameraLookAt: [number, number, number] = [
    currentScaled[0] + (dx / len) * rideDistance * 0.6,
    currentScaled[1] + (dy / len) * rideDistance * 0.6,
    currentScaled[2],
  ];

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />

      {/* Grid */}
      <gridHelper args={[20, 20, isDark ? "#222233" : "#ccccbb", isDark ? "#1a1a2a" : "#e0ddd5"]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Trail */}
      <Trail points={trailPoints} baseColor={trailColor} />

      {/* Word cloud */}
      {wordPoints.map((wp, i) => {
        const nearbyIdx = nearby.findIndex(n => n.coordIdx === i);
        return (
          <WordDot
            key={i}
            position={scaledWords[i]}
            label={wp.word}
            isCurrent={i === currentStep.wordIndex}
            isNearby={nearbySet.has(i)}
            rank={nearbyIdx >= 0 ? nearbyIdx : 99}
            frequency={wp.frequency}
            maxFreq={maxFreq}
            isDark={isDark}
            currentColor={trailColor}
          />
        );
      })}

      {/* Nearby connecting lines */}
      <NearbyLines
        from={currentScaled}
        tos={nearby.slice(0, 6).map(n => scaledWords[n.coordIdx])}
        color="#d4a017"
      />

      {/* Particle */}
      <Particle position={currentScaled} color={trailColor} />

      {/* Current word label above particle */}
      <Billboard position={[currentScaled[0], currentScaled[1] + 0.3, currentScaled[2]]}>
        <Text
          fontSize={0.12}
          color={trailColor}
          anchorX="center"
          anchorY="bottom"
          fontWeight="bold"
        >
          {currentStep.word}
        </Text>
      </Billboard>

      {/* Position label below particle */}
      <Billboard position={[currentScaled[0], currentScaled[1] - 0.2, currentScaled[2]]}>
        <Text
          fontSize={0.05}
          color={isDark ? "#aaaacc" : "#666655"}
          anchorX="center"
          anchorY="top"
        >
          {`word ${currentStep.textPosition + 1} / ${steps.length}`}
        </Text>
      </Billboard>

      {/* Camera controls */}
      {!firstPerson && <OrbitControls enableDamping dampingFactor={0.05} enableZoom enableRotate enablePan />}
      <CameraFollower target={cameraTarget} lookAt={cameraLookAt} active={firstPerson} />
    </>
  );
}

// Camera zoom helper
function CameraZoomHandler({ zoomRef }: { zoomRef: React.MutableRefObject<((factor: number) => void) | null> }) {
  const { camera } = useThree();
  zoomRef.current = (factor: number) => {
    camera.position.multiplyScalar(factor);
  };
  return null;
}

export function TextWalkScene(props: TextWalkSceneProps) {
  const bgColor = props.isDark ? "#0a0a1a" : "#f5f2ec";
  const [crashCount, setCrashCount] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const [rideDistance, setRideDistance] = useState(1.5);
  const zoomRef = useRef<((factor: number) => void) | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const mountTime = useRef(Date.now());

  const exportPNG = useCallback(() => {
    if (!glRef.current) return;
    const dataUrl = glRef.current.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "text-vectorisation.png";
    a.click();
  }, []);

  // Auto-retry up to 3 times on context loss, then show crash screen
  const showCrashScreen = crashCount >= 3;

  const handleContextLoss = useCallback((e: Event) => {
    e.preventDefault();
    const elapsed = Date.now() - mountTime.current;
    if (elapsed < 2000 || crashCount < 2) {
      // Early crash or first few — auto-retry by remounting Canvas
      setTimeout(() => {
        setCrashCount(c => c + 1);
        setCanvasKey(k => k + 1);
      }, 200);
    } else {
      setCrashCount(c => c + 1);
    }
  }, [crashCount]);

  if (showCrashScreen) {
    return (
      <div className="rounded-sm overflow-hidden border border-parchment flex items-center justify-center flex-col gap-3" style={{ height: 500, background: bgColor }}>
        <p className="font-sans text-body-sm text-muted-foreground">3D renderer lost context.</p>
        <button onClick={() => { setCrashCount(0); setCanvasKey(k => k + 1); mountTime.current = Date.now(); }} className="btn-editorial-secondary text-body-sm px-3 py-1.5">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-sm overflow-hidden border border-parchment relative"
      style={{ height: 500, background: bgColor }}
    >
      {/* Zoom buttons */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => {
            if (props.firstPerson) setRideDistance(d => Math.max(0.3, d * 0.7));
            else zoomRef.current?.(0.8);
          }}
          className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center font-sans text-body-sm font-bold shadow-editorial"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => {
            if (props.firstPerson) setRideDistance(d => Math.min(8, d * 1.4));
            else zoomRef.current?.(1.25);
          }}
          className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center font-sans text-body-sm font-bold shadow-editorial"
          title="Zoom out"
        >−</button>
        <button
          onClick={exportPNG}
          className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center font-sans shadow-editorial"
          title="Export PNG"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
      </div>
      <Canvas
        key={canvasKey}
        camera={{ position: [4, 4, 3], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        gl={{
          antialias: true,
          powerPreference: "low-power",
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.domElement.style.touchAction = "pan-y";
          gl.domElement.addEventListener("webglcontextlost", handleContextLoss);
        }}
      >
        <color attach="background" args={[bgColor]} />
        <CameraZoomHandler zoomRef={zoomRef} />
        <Scene {...props} rideDistance={rideDistance} />
      </Canvas>
      <div className="absolute bottom-2 left-2 font-sans text-[9px] text-muted-foreground opacity-60">
        Scroll to zoom. Drag to rotate. Right-drag to pan.
      </div>
    </div>
  );
}
