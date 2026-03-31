"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";

interface WalkStep {
  position: number;
  nearestConcept: string;
  nearestSimilarity: number;
  coords: [number, number, number];
  nearby: Array<{ concept: string; similarity: number; coordIdx: number }>;
}

interface ReferencePoint {
  concept: string;
  coords: [number, number, number];
}

interface WalkSceneProps {
  steps: WalkStep[];
  anchorA: string;
  anchorB: string;
  anchorCoords: { a: [number, number, number]; b: [number, number, number] };
  referencePoints: ReferencePoint[];
  walking: boolean;
  firstPerson: boolean;
  progress: number; // 0 to steps.length - 1
  onProgressChange: (p: number) => void;
  isDark: boolean;
}

function scaleCoords(coords: [number, number, number], scale = 10): [number, number, number] {
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

// The path line
function PathLine({ points, color, width = 1 }: { points: [number, number, number][]; color: string; width?: number }) {
  return (
    <Line
      points={points}
      color={color}
      lineWidth={width}
      transparent
      opacity={0.5}
    />
  );
}

// Trail behind the particle
function Trail({ points, color }: { points: [number, number, number][]; color: string }) {
  if (points.length < 2) return null;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={3}
      transparent
      opacity={0.8}
    />
  );
}

// Reference concept dot
function RefDot({ position, label, isNearby, rank, isDark }: {
  position: [number, number, number];
  label: string;
  isNearby: boolean;
  rank: number; // 0 = nearest, higher = further
  isDark: boolean;
}) {
  const size = isNearby ? Math.max(0.04, 0.1 - rank * 0.008) : 0.025;
  const fontSize = isNearby ? Math.max(0.06, 0.12 - rank * 0.008) : 0;

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[size, 12, 12]} />
        <meshStandardMaterial
          color={isNearby ? "#d4a017" : (isDark ? "#555566" : "#aaa099")}
          emissive={isNearby ? "#d4a017" : "#000000"}
          emissiveIntensity={isNearby ? 0.4 : 0}
          transparent
          opacity={isNearby ? 0.95 : 0.2}
        />
      </mesh>
      {isNearby && (
        <Text
          position={[0, size + 0.05, 0]}
          fontSize={fontSize}
          color={isDark ? "#f0e8d0" : "#3a3020"}
          anchorX="center"
          anchorY="bottom"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

// Anchor diamond
function AnchorMarker({ position, label, color }: {
  position: [number, number, number];
  label: string;
  color: string;
}) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <Text
        position={[0, 0.2, 0]}
        fontSize={0.1}
        color={color}
        anchorX="center"
        anchorY="bottom"
        fontWeight="bold"
      >
        {label}
      </Text>
    </group>
  );
}

// Connecting lines from particle to nearby concepts
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

function Scene({ steps, anchorA, anchorB, anchorCoords, referencePoints, walking, firstPerson, progress, isDark }: Omit<WalkSceneProps, "onProgressChange">) {
  const currentStep = steps[progress] || steps[0];
  const nearby = currentStep?.nearby || [];
  const nearbySet = new Set(nearby.map(n => n.coordIdx));

  const scaledSteps = useMemo(() => steps.map(s => scaleCoords(s.coords)), [steps]);
  const scaledRefs = useMemo(() => referencePoints.map(r => scaleCoords(r.coords)), [referencePoints]);
  const scaledAnchorA = useMemo(() => scaleCoords(anchorCoords.a), [anchorCoords.a]);
  const scaledAnchorB = useMemo(() => scaleCoords(anchorCoords.b), [anchorCoords.b]);
  const currentScaled = scaleCoords(currentStep.coords);
  const trailPoints = scaledSteps.slice(0, progress + 1);

  // Camera target for first-person: behind particle, looking forward
  const nextStep = steps[Math.min(progress + 1, steps.length - 1)];
  const nextScaled = scaleCoords(nextStep.coords);
  const dx = nextScaled[0] - currentScaled[0];
  const dy = nextScaled[1] - currentScaled[1];
  const dz = nextScaled[2] - currentScaled[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
  const cameraTarget: [number, number, number] = [
    currentScaled[0] - (dx / len) * 1.5,
    currentScaled[1] - (dy / len) * 1.5,
    currentScaled[2] + 0.5,
  ];
  const cameraLookAt: [number, number, number] = [
    currentScaled[0] + (dx / len) * 1,
    currentScaled[1] + (dy / len) * 1,
    currentScaled[2],
  ];

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />

      {/* Grid */}
      <gridHelper args={[20, 20, isDark ? "#222233" : "#ccccbb", isDark ? "#1a1a2a" : "#e0ddd5"]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Full path */}
      <PathLine points={scaledSteps} color={isDark ? "#444466" : "#999988"} width={2} />

      {/* Trail */}
      <Trail points={trailPoints} color="#ef4444" />

      {/* Reference concepts */}
      {referencePoints.map((ref, i) => {
        const nearbyIdx = nearby.findIndex(n => n.coordIdx === i);
        return (
          <RefDot
            key={i}
            position={scaledRefs[i]}
            label={ref.concept}
            isNearby={nearbySet.has(i)}
            rank={nearbyIdx >= 0 ? nearbyIdx : 99}
            isDark={isDark}
          />
        );
      })}

      {/* Nearby connecting lines */}
      <NearbyLines
        from={currentScaled}
        tos={nearby.slice(0, 6).map(n => scaledRefs[n.coordIdx])}
        color="#d4a017"
      />

      {/* Anchors */}
      <AnchorMarker position={scaledAnchorA} label={anchorA} color="#d4a017" />
      <AnchorMarker position={scaledAnchorB} label={anchorB} color="#7aa0ff" />

      {/* Particle */}
      <Particle position={currentScaled} color="#ef4444" />

      {/* Blend ratio label above particle */}
      <Text
        position={[currentScaled[0], currentScaled[1] + 0.25, currentScaled[2]]}
        fontSize={0.06}
        color={isDark ? "#aaaacc" : "#666655"}
        anchorX="center"
        anchorY="bottom"
      >
        {`${Math.round((1 - currentStep.position) * 100)}% ${anchorA}  ${Math.round(currentStep.position * 100)}% ${anchorB}`}
      </Text>

      {/* Nearest concept label below particle */}
      <Text
        position={[currentScaled[0], currentScaled[1] - 0.2, currentScaled[2]]}
        fontSize={0.09}
        color="#ef4444"
        anchorX="center"
        anchorY="top"
      >
        {currentStep.nearestConcept}
      </Text>

      {/* Camera controls */}
      {!firstPerson && <OrbitControls enableDamping dampingFactor={0.05} enableZoom enableRotate enablePan />}
      <CameraFollower target={cameraTarget} lookAt={cameraLookAt} active={firstPerson} />
    </>
  );
}

export function WalkScene(props: WalkSceneProps) {
  const bgColor = props.isDark ? "#0a0a1a" : "#f5f2ec";
  const [crashed, setCrashed] = useState(false);

  if (crashed) {
    return (
      <div className="rounded-sm overflow-hidden border border-parchment flex items-center justify-center flex-col gap-3" style={{ height: 500, background: bgColor }}>
        <p className="font-sans text-body-sm text-muted-foreground">3D renderer lost context.</p>
        <button onClick={() => setCrashed(false)} className="btn-editorial-secondary text-body-sm px-3 py-1.5">
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
      <Canvas
        camera={{ position: [15, 15, 10], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        gl={{
          antialias: false,
          powerPreference: "low-power",
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          // Allow touch events for OrbitControls
          gl.domElement.style.touchAction = "pan-y";
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setCrashed(true);
          });
        }}
      >
        <color attach="background" args={[bgColor]} />
        <Scene {...props} />
      </Canvas>
      <div className="absolute bottom-2 left-2 font-sans text-[9px] text-muted-foreground opacity-60">
        Scroll to zoom. Drag to rotate. Right-drag to pan.
      </div>
    </div>
  );
}
