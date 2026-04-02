"use client";

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line, Billboard } from "@react-three/drei";
import * as THREE from "three";

interface TopologyNode {
  label: string;
  shortLabel: string;
  coords: [number, number, number];
  color: string;
  isolated: boolean;
  componentId: number;
  componentSize: number;
}

interface TopologyEdge {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

export interface TopologySceneProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  isDark: boolean;
  showVoids: boolean;
  voidIntensity: number; // 0 (invisible) to 1 (fully opaque)
  voidColor: string;     // hex colour for the void cloud
}

const SCALE = 6;

function scaleCoords(c: [number, number, number]): [number, number, number] {
  return [c[0] * SCALE, c[1] * SCALE, c[2] * SCALE];
}

function NodeDot({ node, isDark }: { node: TopologyNode; isDark: boolean }) {
  const pos = scaleCoords(node.coords);
  const size = node.isolated ? 0.1 : 0.06;
  const labelColor = isDark ? "#c0c0d0" : "#3a3020";
  const fadedColor = isDark ? "#555566" : "#aaa099";
  const [hovered, setHovered] = useState(false);

  return (
    <group position={pos}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[hovered ? size * 1.5 : size, 12, 12]} />
        <meshStandardMaterial
          color={hovered ? "#ffffff" : node.color}
          emissive={node.color}
          emissiveIntensity={hovered ? 0.8 : (node.isolated ? 0.6 : 0.3)}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Short label (always visible) */}
      {!hovered && (
        <Billboard position={[0, size + 0.04, 0]}>
          <Text
            fontSize={node.isolated ? 0.08 : 0.055}
            color={node.isolated ? node.color : (node.componentSize > 3 ? labelColor : fadedColor)}
            anchorX="center"
            anchorY="bottom"
            fillOpacity={node.isolated ? 1 : 0.7}
          >
            {node.shortLabel}
          </Text>
        </Billboard>
      )}
      {/* Full label + info (on hover) with backdrop */}
      {hovered && (() => {
        const compText = `Component ${node.componentId + 1} (${node.componentSize})${node.isolated ? " — ISOLATED" : ""}`;
        // Fixed width panel, let text wrap freely inside it
        const panelW = 2.8;
        const textW = panelW - 0.12;
        const charW = 0.036;
        const lines = Math.max(1, Math.ceil(node.label.length * charW / textW));
        const panelH = lines * 0.085 + 0.12;
        return (
        <Billboard position={[0, size + 0.06, 0]}>
          {/* Semi-opaque backdrop */}
          <mesh position={[0, panelH * 0.3, -0.01]}>
            <planeGeometry args={[panelW, panelH]} />
            <meshBasicMaterial
              color={isDark ? "#0a0a1a" : "#f5f2ec"}
              transparent
              opacity={0.88}
              depthWrite={false}
            />
          </mesh>
          <Text
            fontSize={0.07}
            color={isDark ? "#f0e8d0" : "#1a1a1a"}
            anchorX="center"
            anchorY="bottom"
            fillOpacity={1}
            maxWidth={textW}
          >
            {node.label}
          </Text>
          <Text
            fontSize={0.04}
            color={node.color}
            anchorX="center"
            anchorY="top"
            position={[0, -0.02, 0]}
          >
            {compText}
          </Text>
        </Billboard>
        );
      })()}
    </group>
  );
}

function EdgeLine({ edge }: { edge: TopologyEdge }) {
  return (
    <Line
      points={[scaleCoords(edge.from), scaleCoords(edge.to)]}
      color={edge.color}
      lineWidth={1}
      transparent
      opacity={0.25}
    />
  );
}

/** Create a soft radial gradient texture for fog-like particles */
function createSoftParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.15, "rgba(255,255,255,0.8)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.4)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.12)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * VoidCloud — nebulous fog filling empty regions INSIDE the manifold.
 * Uses soft sprite particles (radial gradient) for a cloud-like appearance.
 * Only places particles within the convex interior of the concept cloud.
 */
function VoidCloud({ nodes, intensity, voidColor: colorHex }: { nodes: TopologyNode[]; isDark: boolean; intensity: number; voidColor: string }) {
  const SAMPLE_COUNT = 5000;
  const MIN_DIST = 0.5;

  const texture = useMemo(() => createSoftParticleTexture(), []);

  const voidPositions = useMemo(() => {
    if (nodes.length < 4) return new Float32Array(0);

    const scaled = nodes.map(n => scaleCoords(n.coords));

    // Centroid
    let cx = 0, cy = 0, cz = 0;
    for (const [x, y, z] of scaled) { cx += x; cy += y; cz += z; }
    cx /= scaled.length; cy /= scaled.length; cz /= scaled.length;

    // Hull radius (shrunk to 85%)
    let maxRadiusSq = 0;
    for (const [x, y, z] of scaled) {
      const d = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
      if (d > maxRadiusSq) maxRadiusSq = d;
    }
    const hullRadius = Math.sqrt(maxRadiusSq) * 0.9;

    // Deterministic random
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    };

    // Sample uniformly within a sphere using spherical coordinates
    // This produces a round, organic cloud with no cubic edges
    const candidates: { x: number; y: number; z: number; depth: number }[] = [];
    for (let i = 0; i < SAMPLE_COUNT * 4; i++) {
      // Uniform distribution inside sphere: radius cuberoot for uniform volume
      const r = hullRadius * Math.cbrt(rand());
      const theta = Math.acos(2 * rand() - 1);  // polar angle [0, pi]
      const phi = 2 * Math.PI * rand();           // azimuthal angle [0, 2pi]

      const x = cx + r * Math.sin(theta) * Math.cos(phi);
      const y = cy + r * Math.sin(theta) * Math.sin(phi);
      const z = cz + r * Math.cos(theta);

      // Must be far from all concept nodes
      let minDistSq = Infinity;
      for (const [nx, ny, nz] of scaled) {
        const d = (x - nx) ** 2 + (y - ny) ** 2 + (z - nz) ** 2;
        if (d < minDistSq) minDistSq = d;
      }
      if (minDistSq < MIN_DIST * MIN_DIST) continue;

      candidates.push({ x, y, z, depth: Math.sqrt(minDistSq) });
    }

    // Accept with probability proportional to depth squared (denser in deepest voids)
    const maxDepth = candidates.reduce((m, c) => Math.max(m, c.depth), 0) || 1;
    const pts: number[] = [];
    for (const c of candidates) {
      if (pts.length / 3 >= SAMPLE_COUNT) break;
      const depthNorm = c.depth / maxDepth;
      const acceptProb = 0.3 + depthNorm * depthNorm * 0.7;
      if (rand() < acceptProb) {
        pts.push(c.x, c.y, c.z);
      }
    }
    for (const c of candidates) {
      if (pts.length / 3 >= SAMPLE_COUNT) break;
      pts.push(c.x, c.y, c.z);
    }

    return new Float32Array(pts);
  }, [nodes]);

  if (voidPositions.length === 0) return null;

  // Use the selected colour, intensity controls opacity and size
  const color = new THREE.Color(colorHex);
  const opacity = 0.1 + intensity * 0.8;    // max 0.9 at full intensity
  const particleSize = 0.3 + intensity * 0.4; // max 0.7 at full intensity

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(voidPositions, 3));
    return geo;
  }, [voidPositions]);

  // Custom shader: near camera = small, sharp, defined; far = large, diffuse, faded
  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uColor: { value: color },
      uOpacity: { value: opacity },
      uBaseSize: { value: particleSize },
    },
    vertexShader: `
      uniform float uBaseSize;
      varying float vDist;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = -mvPosition.z;
        vDist = clamp((dist - 2.0) / 12.0, 0.0, 1.0); // 0 = near, 1 = far
        // Near: small and tight. Far: large and diffuse.
        float sizeMul = 0.4 + vDist * 1.6;
        gl_PointSize = uBaseSize * sizeMul * (300.0 / dist);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vDist;
      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        // Near: more opaque, sharper. Far: more transparent, softer.
        float nearOpacity = uOpacity * (1.0 + 0.8 * (1.0 - vDist));
        float farFade = 1.0 - vDist * 0.5;
        float alpha = tex.a * nearOpacity * farFade;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [texture, color, opacity, particleSize]);

  // Update uniforms when intensity changes
  shaderMaterial.uniforms.uColor.value = color;
  shaderMaterial.uniforms.uOpacity.value = opacity;
  shaderMaterial.uniforms.uBaseSize.value = particleSize;

  return <points geometry={geometry} material={shaderMaterial} />;
}

function Scene({ nodes, edges, isDark, showVoids, voidIntensity, voidColor }: TopologySceneProps) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />

      <gridHelper
        args={[16, 16, isDark ? "#222233" : "#ccccbb", isDark ? "#1a1a2a" : "#e0ddd5"]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Void particle cloud */}
      {showVoids && <VoidCloud nodes={nodes} isDark={isDark} intensity={voidIntensity} voidColor={voidColor} />}

      {/* Edges */}
      {edges.map((e, i) => (
        <EdgeLine key={i} edge={e} />
      ))}

      {/* Nodes */}
      {nodes.map((n, i) => (
        <NodeDot key={i} node={n} isDark={isDark} />
      ))}

      <OrbitControls enableDamping dampingFactor={0.05} enableZoom enableRotate enablePan />
    </>
  );
}

/** Auto-rotate camera around the origin, preserving current distance and elevation */
function AutoRotate({ active }: { active: boolean }) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!active) return;
    const dist = camera.position.length();
    const elev = Math.asin(camera.position.y / dist);
    const angle = Math.atan2(camera.position.z, camera.position.x);
    const newAngle = angle + delta * 0.3; // ~0.3 rad/s rotation
    camera.position.x = dist * Math.cos(elev) * Math.cos(newAngle);
    camera.position.z = dist * Math.cos(elev) * Math.sin(newAngle);
    camera.position.y = dist * Math.sin(elev);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function CameraZoomHandler({ zoomRef, savedPosition }: {
  zoomRef: React.MutableRefObject<((factor: number) => void) | null>;
  savedPosition: React.MutableRefObject<[number, number, number] | null>;
}) {
  const { camera } = useThree();

  // Restore saved camera position on mount
  useEffect(() => {
    if (savedPosition.current) {
      camera.position.set(...savedPosition.current);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  zoomRef.current = (factor: number) => {
    camera.position.multiplyScalar(factor);
  };

  // Save camera position every frame (captures orbit, zoom, pan)
  useFrame(() => {
    savedPosition.current = [camera.position.x, camera.position.y, camera.position.z];
  });

  return null;
}

export function TopologyScene(props: TopologySceneProps) {
  const bgColor = props.isDark ? "#0a0a1a" : "#f5f2ec";
  const [crashCount, setCrashCount] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const [rotating, setRotating] = useState(false);
  const zoomRef = useRef<((factor: number) => void) | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const savedCameraPos = useRef<[number, number, number] | null>(null);
  const mountTime = useRef(Date.now());

  const exportPNG = useCallback(() => {
    if (!glRef.current) return;
    const dataUrl = glRef.current.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "topological-voids-rips-complex.png";
    a.click();
  }, []);

  const showCrashScreen = crashCount >= 3;

  const handleContextLoss = useCallback((e: Event) => {
    e.preventDefault();
    const elapsed = Date.now() - mountTime.current;
    if (elapsed < 2000 || crashCount < 2) {
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
      <div className="rounded-sm overflow-hidden border border-parchment flex items-center justify-center flex-col gap-3" style={{ height: 450, background: bgColor }}>
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
      style={{ height: 450, background: bgColor }}
    >
      {/* Zoom + export buttons */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => zoomRef.current?.(0.8)}
          className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center font-sans text-body-sm font-bold shadow-editorial"
          title="Zoom in"
        >+</button>
        <button
          onClick={() => zoomRef.current?.(1.25)}
          className="w-7 h-7 rounded-sm bg-card/80 border border-parchment-dark text-foreground hover:bg-card flex items-center justify-center font-sans text-body-sm font-bold shadow-editorial"
          title="Zoom out"
        >−</button>
        <button
          onClick={() => setRotating(r => !r)}
          className={`w-7 h-7 rounded-sm border border-parchment-dark hover:bg-card flex items-center justify-center font-sans shadow-editorial ${
            rotating ? "bg-burgundy/20 text-burgundy" : "bg-card/80 text-foreground"
          }`}
          title={rotating ? "Stop rotation" : "Auto-rotate"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
        </button>
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
        camera={{ position: [2.5, 2.5, 2], fov: 50 }}
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
        <CameraZoomHandler zoomRef={zoomRef} savedPosition={savedCameraPos} />
        <AutoRotate active={rotating} />
        <Scene {...props} />
      </Canvas>
      <div className="absolute bottom-2 left-2 font-sans text-[9px] text-muted-foreground opacity-60">
        Scroll to zoom. Drag to rotate. Right-drag to pan.
      </div>
    </div>
  );
}
