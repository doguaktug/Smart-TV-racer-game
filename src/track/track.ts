// Track authoring format and its compiler.
//
// A track is written as a list of sections (straights and constant-radius
// turns). compileTrack() cuts it into fixed-length segments stored in flat
// typed arrays, so the sim and renderer look up any position in O(1).

import { dcos, dsin, PI, TAU } from "../sim/dmath";

export interface SectionDef {
  /** Length in metres. */
  length: number;
  /** Total direction change over the section, degrees. + = right, - = left. Omit for a straight. */
  turn?: number;
  /** Road width in metres. Defaults to the track width. */
  width?: number;
}

export interface TrackDef {
  name: string;
  /** Default road width, metres. */
  width: number;
  sections: SectionDef[];
}

export interface Track {
  readonly name: string;
  /** Length of one segment, metres. */
  readonly segLen: number;
  /** Number of segments in one lap. */
  readonly count: number;
  /** Lap length, metres (= count * segLen). */
  readonly length: number;
  /** Per segment: curvature, radians per metre. + = turning right. */
  readonly curvature: Float64Array;
  /** Per segment: road width, metres. */
  readonly width: Float64Array;
  /** Per segment: centreline start point in world space, metres (top-down view, minimap). */
  readonly px: Float64Array;
  readonly py: Float64Array;
}

export const SEGMENT_LENGTH = 5;

/** The end of a lap must land within this many metres of its start. */
const CLOSE_TOLERANCE = 1;
/** ...and point the same way, within this many radians. */
const HEADING_TOLERANCE = 1e-6;

export function compileTrack(def: TrackDef, segLen = SEGMENT_LENGTH): Track {
  if (def.sections.length === 0) throw new Error(`${def.name}: no sections`);

  const perSection = def.sections.map((sec, i) => {
    if (!(sec.length > 0)) throw new Error(`${def.name}: section ${i} needs a positive length`);
    return Math.max(1, Math.round(sec.length / segLen));
  });
  const count = perSection.reduce((a, b) => a + b, 0);

  const curvature = new Float64Array(count);
  const width = new Float64Array(count);
  let i = 0;
  def.sections.forEach((sec, k) => {
    const n = perSection[k]!;
    const c = ((sec.turn ?? 0) * PI) / 180 / (n * segLen);
    const w = sec.width ?? def.width;
    // Physics divides by (1 - k * x). Radius >= road width keeps that well above 0.
    if (Math.abs(c) * w > 1) {
      throw new Error(`${def.name}: section ${k} turns too tight, radius must be at least ${w} m`);
    }
    for (let j = 0; j < n; j++, i++) {
      curvature[i] = c;
      width[i] = w;
    }
  });

  // Walk the centreline. World axes: +x east, +y north. Direction 0 = north,
  // positive = clockwise (a right turn). Each step uses the mid-segment
  // direction, which keeps the walk accurate on curves.
  const px = new Float64Array(count);
  const py = new Float64Array(count);
  let x = 0;
  let y = 0;
  let dir = 0;
  for (let n = 0; n < count; n++) {
    px[n] = x;
    py[n] = y;
    const turn = curvature[n]! * segLen;
    const mid = dir + turn / 2;
    x += dsin(mid) * segLen;
    y += dcos(mid) * segLen;
    dir += turn;
  }

  const dirError = dir - Math.round(dir / TAU) * TAU;
  if (Math.abs(dirError) > HEADING_TOLERANCE) {
    throw new Error(`${def.name}: lap ends facing the wrong way (turns must sum to ±360°)`);
  }
  const gap = Math.sqrt(x * x + y * y);
  if (gap > CLOSE_TOLERANCE) {
    throw new Error(`${def.name}: lap does not close, end is ${gap.toFixed(2)} m from start`);
  }

  return { name: def.name, segLen, count, length: count * segLen, curvature, width, px, py };
}

/** Wrap any distance into [0, track.length). */
export function wrapS(track: Track, s: number): number {
  const r = s % track.length;
  return r < 0 ? r + track.length : r;
}

/** Index of the segment that contains distance s (any value; it is wrapped). */
export function segmentIndex(track: Track, s: number): number {
  const i = Math.floor(wrapS(track, s) / track.segLen);
  return i < track.count ? i : track.count - 1;
}
