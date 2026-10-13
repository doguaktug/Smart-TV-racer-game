// Drafting. A game rule, not aero: a car close behind another, inside its
// slipstream for DRAFT.lockIn seconds, makes a "pair". Both cars in a pair get
// a higher top speed, and the bonus grows in tiers the longer the pair holds.
//
// When the follower steers out (centres 1.6 m or more apart) the pair breaks and
// both cars start losing the bonus. If the follower then pulls up tight beside
// the leader (centres 2-2.5 m apart, bumpers 0.3 m or closer) the leader gets
// extra deceleration until the two are side by side. That is how the follower gets by. Runs after stepPhysics each
// tick and only changes speed.

import { BRAKE } from "./actions";
import type { Cars } from "./cars";
import { TUNING } from "./physics";
import type { Track } from "../track/track";

export const DRAFT = {
  /** Max gap to the car ahead, bumper to bumper along the track, metres. */
  range: 3,
  /** Side offset between centres at which the follower is out of the slipstream, metres. */
  halfWidth: 1.5,
  /** An existing pair only breaks this far past range / halfWidth, so it does not flicker, metres. */
  margin: 0.1,
  /** Seconds a follower must hold the slipstream before the pair counts. */
  lockIn: 2,
  /** Pressing the leader needs a side offset between centres above sideMin... */
  sideMin: 2,
  /** ...and below sideWidth, metres. Past sideWidth the follower loses its link to the leader. */
  sideWidth: 2.5,
  /** Pressing starts with the bumpers this close along the track, metres. */
  pressRange: 0.3,
  /** Extra deceleration on a leader with its old follower pressing beside it, m/s². */
  sidePressure: 3,
  /** Seconds in the draft to reach tier 1, 2, 3. */
  tierTime: [1, 3, 6],
  /** Top speed bonus per tier, fraction of top speed. Index 0 = no tier. */
  topBonus: [0, 0.03, 0.06, 0.1],
  /** Out of the draft, built-up time drains this many times faster than it builds. */
  drain: 4,
};

/** Tier 0-3 for a built-up draft time. Also drives the flame effect (red / green / blue). */
export function draftTier(seconds: number): number {
  const t = DRAFT.tierTime;
  return seconds >= t[2]! ? 3 : seconds >= t[1]! ? 2 : seconds >= t[0]! ? 1 : 0;
}

/** Signed distance from s `from` forward to s `to`, wrapped into [-length/2, length/2). */
function gapAhead(track: Track, from: number, to: number): number {
  const half = track.length / 2;
  let d = to - from;
  if (d >= half) d -= track.length;
  else if (d < -half) d += track.length;
  return d;
}

/** Centre-to-centre gap that puts the bumpers DRAFT.range apart. */
function maxCentreGap(): number {
  return DRAFT.range + 2 * TUNING.halfLength;
}

/**
 * The nearest car whose slipstream car i is in, or -1. The car i is already
 * behind (cars.leader[i]) gets DRAFT.margin extra on both limits.
 */
export function findLeader(cars: Cars, track: Track, i: number): number {
  const was = cars.leader[i]!;
  let best = -1;
  let bestGap = Infinity;
  for (let j = 0; j < cars.count; j++) {
    if (j === i) continue;
    const extra = j === was ? DRAFT.margin : 0;
    const gap = gapAhead(track, cars.s[i]!, cars.s[j]!);
    const dx = Math.abs(cars.x[j]! - cars.x[i]!);
    if (gap > 0 && gap < bestGap && gap <= maxCentreGap() + extra && dx < DRAFT.halfWidth + extra) {
      best = j;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Car i, just out of car j's slipstream, is still close enough to keep its link
 * to j: behind j within draft range (+ margin) and less than sideWidth to the side.
 */
function nearby(cars: Cars, track: Track, i: number, j: number): boolean {
  if (Math.abs(cars.x[i]! - cars.x[j]!) >= DRAFT.sideWidth) return false;
  const gap = gapAhead(track, cars.s[i]!, cars.s[j]!);
  return gap > 0 && gap <= maxCentreGap() + DRAFT.margin;
}

/**
 * Car i is tight beside car j: centres sideMin to sideWidth apart, from
 * pressRange bumper to bumper until i's centre reaches j's (side by side).
 */
function pressing(cars: Cars, track: Track, i: number, j: number): boolean {
  const dx = Math.abs(cars.x[i]! - cars.x[j]!);
  if (dx <= DRAFT.sideMin || dx >= DRAFT.sideWidth) return false;
  const gap = gapAhead(track, cars.s[i]!, cars.s[j]!);
  return gap > 0 && gap <= 2 * TUNING.halfLength + DRAFT.pressRange;
}

/** Update draft state and apply draft speed. Call right after stepPhysics. */
export function stepDraft(cars: Cars, track: Track, inputs: Uint8Array, dt: number): void {
  const D = DRAFT;
  const maxTime = D.tierTime[2]!;

  // Pass 1: who drafts whom, and which leaders have their old follower beside them.
  // Bitmasks, bit i = car i (MAX_CARS <= 8).
  let drafting = 0; // car i is in a locked-in pair, as follower
  let followed = 0; // car i is in a locked-in pair, as leader
  let pressed = 0; // car i's old follower is pressing beside it
  for (let i = 0; i < cars.count; i++) {
    const was = cars.leader[i]!;
    const lockedIn = cars.lock[i]! >= D.lockIn;
    let now = findLeader(cars, track, i);
    if (now >= 0) {
      const lock = Math.min(D.lockIn, (now === was ? cars.lock[i]! : 0) + dt);
      cars.lock[i] = lock;
      if (lock >= D.lockIn) {
        drafting |= 1 << i;
        followed |= 1 << now;
      }
    } else if (was >= 0 && lockedIn && nearby(cars, track, i, was)) {
      now = was; // keep the link while it stays close
      if (pressing(cars, track, i, was)) pressed |= 1 << was;
    } else {
      cars.lock[i] = 0;
    }
    cars.leader[i] = now;
  }

  // Pass 2: build or drain draft time, apply the tier bonus and side pressure.
  for (let i = 0; i < cars.count; i++) {
    const bit = 1 << i;
    const inPair = ((drafting | followed) & bit) !== 0;
    let t = cars.draft[i]!;
    t = inPair ? Math.min(maxTime, t + dt) : Math.max(0, t - D.drain * dt);
    cars.draft[i] = t;

    let v = cars.v[i]!;
    // Extra accel that moves the equilibrium in physics from top to top * (1 + bonus).
    if ((inputs[i]! & BRAKE) === 0) v += TUNING.accel * D.topBonus[draftTier(t)]! * dt;
    if (pressed & bit) v = Math.max(0, v - D.sidePressure * dt);
    cars.v[i] = v;
  }
}
