/**
 * Manifold Atlas — Persistent Homology (Topological Data Analysis)
 * Concept and Design: David M. Berry, University of Sussex
 *
 * Pure TypeScript implementation of Vietoris-Rips persistent homology.
 * Computes H0 (connected components) via union-find and H1 (loops)
 * via cycle-creating edge detection with BFS representative cycles.
 *
 * Designed for ≤150 concepts. For larger datasets, consider Ripser WASM.
 */

import { cosineSimilarity } from "./cosine";

// ---- Data structures ----

export interface PersistenceFeature {
  dimension: number;              // 0 = connected component, 1 = loop
  birth: number;                  // distance threshold where feature appears
  death: number;                  // distance threshold where feature disappears (Infinity = immortal)
  persistence: number;            // death - birth
  representativeIndices: number[]; // indices of concepts involved
}

export interface BettiPoint {
  threshold: number;
  beta0: number;
  beta1: number;
}

export interface FiltrationEdge {
  i: number;
  j: number;
  distance: number;
}

export interface TopologyResult {
  modelId: string;
  modelName: string;
  concepts: string[];
  features: PersistenceFeature[];
  bettiCurve: BettiPoint[];
  distMatrix: number[][];
  filtrationEdges: FiltrationEdge[];
}

// ---- Union-Find ----

class UnionFind {
  parent: number[];
  rank: number[];
  size: number[];
  private birthOrder: number[]; // lower = elder

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
    this.size = new Array(n).fill(1);
    this.birthOrder = Array.from({ length: n }, (_, i) => i);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  /** Union by rank. Returns [elder root, younger root] or null if already same set. */
  union(x: number, y: number): [number, number] | null {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return null;

    // Elder rule: the component with lower birth order survives
    const elder = this.birthOrder[rx] <= this.birthOrder[ry] ? rx : ry;
    const younger = elder === rx ? ry : rx;

    // Attach younger under elder
    if (this.rank[elder] < this.rank[younger]) {
      this.rank[elder] = this.rank[younger]; // promote elder's rank if needed
    }
    this.parent[younger] = elder;
    if (this.rank[elder] === this.rank[younger]) {
      this.rank[elder]++;
    }
    this.size[elder] += this.size[younger];

    return [elder, younger];
  }

  /** Get all members of the component containing x */
  componentOf(x: number): number[] {
    const root = this.find(x);
    const members: number[] = [];
    for (let i = 0; i < this.parent.length; i++) {
      if (this.find(i) === root) members.push(i);
    }
    return members;
  }

  /** Get all distinct components */
  allComponents(): number[][] {
    const map = new Map<number, number[]>();
    for (let i = 0; i < this.parent.length; i++) {
      const root = this.find(i);
      if (!map.has(root)) map.set(root, []);
      map.get(root)!.push(i);
    }
    return Array.from(map.values());
  }
}

// ---- Distance computation ----

export function cosineDistanceMatrix(vectors: number[][]): number[][] {
  const n = vectors.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = 1 - cosineSimilarity(vectors[i], vectors[j]);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

// ---- Filtration ----

export function buildFiltration(distMatrix: number[][]): FiltrationEdge[] {
  const n = distMatrix.length;
  const edges: FiltrationEdge[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push({ i, j, distance: distMatrix[i][j] });
    }
  }
  edges.sort((a, b) => a.distance - b.distance);
  return edges;
}

// ---- H0: Connected components ----

function computeH0(n: number, filtration: FiltrationEdge[]): {
  features: PersistenceFeature[];
  uf: UnionFind;
} {
  const uf = new UnionFind(n);
  const features: PersistenceFeature[] = [];

  for (const edge of filtration) {
    const result = uf.union(edge.i, edge.j);
    if (result) {
      const [elder, younger] = result;
      // The younger component dies at this threshold
      const youngerMembers = uf.componentOf(younger);
      // But after union, componentOf(younger) returns elder's full component
      // So we need to track members before the union... let's use a different approach
      features.push({
        dimension: 0,
        birth: 0,
        death: edge.distance,
        persistence: edge.distance,
        representativeIndices: [edge.i, edge.j],
      });
    }
  }

  // The surviving component (immortal, never dies)
  features.push({
    dimension: 0,
    birth: 0,
    death: Infinity,
    persistence: Infinity,
    representativeIndices: uf.componentOf(uf.find(0)),
  });

  return { features, uf };
}

// ---- H1: Loops (simplified) ----

function computeH1(n: number, filtration: FiltrationEdge[]): PersistenceFeature[] {
  const uf = new UnionFind(n);
  const adjacency: Set<number>[] = Array.from({ length: n }, () => new Set());
  const features: PersistenceFeature[] = [];

  for (const edge of filtration) {
    const ri = uf.find(edge.i);
    const rj = uf.find(edge.j);

    if (ri === rj) {
      // Cycle-creating edge! This is the birth of an H1 feature.
      // Find the representative cycle via BFS
      const cycle = findShortestCycle(adjacency, edge.i, edge.j, n);
      features.push({
        dimension: 1,
        birth: edge.distance,
        death: Infinity, // simplified: we don't compute exact H1 deaths
        persistence: Infinity,
        representativeIndices: cycle,
      });
    } else {
      uf.union(edge.i, edge.j);
    }

    // Always add to adjacency for future cycle detection
    adjacency[edge.i].add(edge.j);
    adjacency[edge.j].add(edge.i);
  }

  // Approximate H1 deaths: a cycle dies when a triangle fills it in.
  // For each H1 feature, check if any triangle involving its cycle edges
  // appears in the filtration. The triangle's entry time = max edge distance.
  approximateH1Deaths(features, filtration, n);

  return features;
}

/** BFS to find shortest path from src to dst in the current adjacency (excluding the direct edge) */
function findShortestCycle(adjacency: Set<number>[], src: number, dst: number, n: number): number[] {
  const visited = new Array(n).fill(false);
  const parent = new Array(n).fill(-1);
  const queue: number[] = [src];
  visited[src] = true;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const next of adjacency[curr]) {
      if (next === dst && curr !== src) {
        // Found path back to dst, reconstruct
        const path: number[] = [dst, curr];
        let p = curr;
        while (parent[p] !== -1) {
          p = parent[p];
          path.push(p);
        }
        return path;
      }
      if (!visited[next]) {
        visited[next] = true;
        parent[next] = curr;
        queue.push(next);
      }
    }
  }

  // Fallback: just return the two endpoints
  return [src, dst];
}

/** Approximate H1 deaths by checking when triangles fill in cycles */
function approximateH1Deaths(
  features: PersistenceFeature[],
  filtration: FiltrationEdge[],
  _n: number,
): void {
  if (features.length === 0) return;

  // Build edge distance lookup
  const edgeDist = new Map<string, number>();
  for (const e of filtration) {
    const key = e.i < e.j ? `${e.i}-${e.j}` : `${e.j}-${e.i}`;
    if (!edgeDist.has(key)) edgeDist.set(key, e.distance);
  }

  const getEdgeDist = (a: number, b: number): number | undefined => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    return edgeDist.get(key);
  };

  // For each H1 feature, check triangles formed by consecutive cycle vertices
  for (const feat of features) {
    if (feat.dimension !== 1) continue;
    const cycle = feat.representativeIndices;
    if (cycle.length < 3) continue;

    let minTriangleTime = Infinity;

    // Check all triangles that could fill parts of this cycle
    for (let a = 0; a < cycle.length; a++) {
      for (let b = a + 1; b < cycle.length; b++) {
        for (let c = b + 1; c < cycle.length; c++) {
          const dab = getEdgeDist(cycle[a], cycle[b]);
          const dbc = getEdgeDist(cycle[b], cycle[c]);
          const dac = getEdgeDist(cycle[a], cycle[c]);
          if (dab !== undefined && dbc !== undefined && dac !== undefined) {
            const triangleTime = Math.max(dab, dbc, dac);
            if (triangleTime < minTriangleTime && triangleTime > feat.birth) {
              minTriangleTime = triangleTime;
            }
          }
        }
      }
    }

    if (minTriangleTime < Infinity) {
      feat.death = minTriangleTime;
      feat.persistence = feat.death - feat.birth;
    }
  }
}

// ---- Betti curve ----

function computeBettiCurve(
  features: PersistenceFeature[],
  maxThreshold: number,
  steps = 100,
): BettiPoint[] {
  const curve: BettiPoint[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * maxThreshold;
    let beta0 = 0;
    let beta1 = 0;
    for (const f of features) {
      if (f.birth <= t && (f.death === Infinity || t < f.death)) {
        if (f.dimension === 0) beta0++;
        else if (f.dimension === 1) beta1++;
      }
    }
    curve.push({ threshold: t, beta0, beta1 });
  }
  return curve;
}

// ---- Main entry point ----

export function computeTopology(
  concepts: string[],
  vectors: number[][],
  modelId: string,
  modelName: string,
): TopologyResult {
  const distMatrix = cosineDistanceMatrix(vectors);
  const filtration = buildFiltration(distMatrix);
  const maxDist = filtration.length > 0 ? filtration[filtration.length - 1].distance : 1;

  const h0Result = computeH0(concepts.length, filtration);
  const h1Features = computeH1(concepts.length, filtration);

  const allFeatures = [...h0Result.features, ...h1Features];
  const bettiCurve = computeBettiCurve(allFeatures, maxDist);

  return {
    modelId,
    modelName,
    concepts,
    features: allFeatures,
    bettiCurve,
    distMatrix,
    filtrationEdges: filtration,
  };
}

// ---- Utilities for the UI ----

/** Get connected components at a given threshold */
export function componentsAtThreshold(
  n: number,
  filtration: FiltrationEdge[],
  threshold: number,
): number[][] {
  const uf = new UnionFind(n);
  for (const edge of filtration) {
    if (edge.distance > threshold) break;
    uf.union(edge.i, edge.j);
  }
  return uf.allComponents();
}

/** Get edges present at a given threshold */
export function edgesAtThreshold(
  filtration: FiltrationEdge[],
  threshold: number,
): FiltrationEdge[] {
  return filtration.filter(e => e.distance <= threshold);
}
