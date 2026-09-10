import type { Point2D } from '../types';

export interface SampledPoint {
  point: Point2D;
  distance: number;
  tangent: Point2D;
  normal: Point2D;
  segmentIndex: number;
}

export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function polylineLength(points: Point2D[]): number {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += distance(points[i], points[i + 1]);
  }
  return len;
}

export function normalize(v: Point2D): Point2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-8) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function segmentNormal(p1: Point2D, p2: Point2D): Point2D {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-8) return { x: 0, y: 1 };
  // 90-degree CCW perpendicular normal: (-dy, dx)
  return { x: -dy / len, y: dx / len };
}

export function computeMiterOffsets(points: Point2D[], halfWidth: number): { left: Point2D[]; right: Point2D[] } {
  const n = points.length;
  if (n < 2) {
    return { left: [], right: [] };
  }

  const left: Point2D[] = [];
  const right: Point2D[] = [];

  // Segment normals
  const segNormals: Point2D[] = [];
  for (let i = 0; i < n - 1; i++) {
    segNormals.push(segmentNormal(points[i], points[i + 1]));
  }

  // First vertex
  left.push({
    x: points[0].x + segNormals[0].x * halfWidth,
    y: points[0].y + segNormals[0].y * halfWidth,
  });
  right.push({
    x: points[0].x - segNormals[0].x * halfWidth,
    y: points[0].y - segNormals[0].y * halfWidth,
  });

  // Interior vertices
  for (let i = 1; i < n - 1; i++) {
    const n1 = segNormals[i - 1];
    const n2 = segNormals[i];

    // Average normal
    const avg = normalize({ x: n1.x + n2.x, y: n1.y + n2.y });
    // Dot product with segment normal gives cos(theta/2)
    const dot = avg.x * n1.x + avg.y * n1.y;
    const miterScale = Math.min(Math.max(dot > 0.05 ? 1 / dot : 1, 0.5), 2.5); // Clamp miter spike
    const actualOffset = halfWidth * miterScale;

    left.push({
      x: points[i].x + avg.x * actualOffset,
      y: points[i].y + avg.y * actualOffset,
    });
    right.push({
      x: points[i].x - avg.x * actualOffset,
      y: points[i].y - avg.y * actualOffset,
    });
  }

  // Last vertex
  const lastNorm = segNormals[segNormals.length - 1];
  left.push({
    x: points[n - 1].x + lastNorm.x * halfWidth,
    y: points[n - 1].y + lastNorm.y * halfWidth,
  });
  right.push({
    x: points[n - 1].x - lastNorm.x * halfWidth,
    y: points[n - 1].y - lastNorm.y * halfWidth,
  });

  return { left, right };
}

/**
 * Samples uniform intervals along a polyline (e.g. for bridge piers or lamp posts)
 */
export function samplePointsAlongPolyline(
  points: Point2D[],
  interval: number,
  startOffset = interval / 2
): SampledPoint[] {
  if (points.length < 2 || interval <= 0) return [];

  const totalLen = polylineLength(points);
  if (totalLen < startOffset) return [];

  const sampled: SampledPoint[] = [];
  let targetDist = startOffset;

  // Pre-calculate cumulative lengths
  const cumLengths: number[] = [0];
  for (let i = 0; i < points.length - 1; i++) {
    cumLengths.push(cumLengths[i] + distance(points[i], points[i + 1]));
  }

  let segIdx = 0;
  while (targetDist <= totalLen - startOffset * 0.5) {
    while (segIdx < points.length - 2 && cumLengths[segIdx + 1] < targetDist) {
      segIdx++;
    }

    const segStartDist = cumLengths[segIdx];
    const segEndDist = cumLengths[segIdx + 1];
    const segLen = segEndDist - segStartDist;

    const t = segLen > 1e-6 ? (targetDist - segStartDist) / segLen : 0;
    const p1 = points[segIdx];
    const p2 = points[segIdx + 1];

    const pt: Point2D = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };

    const tangent = normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
    const normal = { x: -tangent.y, y: tangent.x };

    sampled.push({
      point: pt,
      distance: targetDist,
      tangent,
      normal,
      segmentIndex: segIdx,
    });

    targetDist += interval;
  }

  return sampled;
}

/**
 * Computes 2D polygon signed area (positive for CCW, negative for CW)
 */
export function polygonArea(points: Point2D[]): number {
  const n = points.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

export function isClockwise(points: Point2D[]): boolean {
  return polygonArea(points) < 0;
}

export function ensureCCW(points: Point2D[]): Point2D[] {
  if (isClockwise(points)) {
    return [...points].reverse();
  }
  return [...points];
}
