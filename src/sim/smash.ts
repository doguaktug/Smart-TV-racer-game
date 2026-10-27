// Smash and juke. A game rule on top of collide.ts, which still keeps the cars
// apart. Aggression + left/right starts a lunge: the car slides sideways for
// SMASH.lunge seconds with steering locked. The first car it touches on that
// side, beside it (not behind), loses a lot of speed; the smasher gains a little.
//
// Aggression + brake starts a juke: a short hard brake. A smash landing during
// the window misses, and the juker gets its speed from before the brake back,
// plus a little. With no smash to dodge, the juke is just a hard brake.
//
// A lunge that hits no one costs speed: a lot if it ends at the road edge (the
// barrier), less if it just swings at air. Runs after stepPhysics.

import { AGGRO, BRAKE, steerDir } from "./actions";
import type { Cars } from "./cars";
import { contact } from "./collide";
import { TUNING } from "./physics";
import { segmentIndex, type Track } from "../track/track";

export const SMASH = {
  /** Seconds a lunge lasts. */
  lunge: 0.3,
  /** Sideways speed during a lunge, m/s. */
  lungeSpeed: 6,
  /** Seconds after starting a smash before the next one. */
  cooldown: 3,
  /** Speed the smashed car loses, m/s. */
  hitLoss: 12,
  /** Turn rate kicked into the smashed car, rad/s, toward the lunge side. */
  hitYaw: 0.6,
  /** Speed the smasher gains on a hit, m/s. */
  hitBoost: 2,
  /** Speed lost by a lunge that ends at the road edge, m/s. */
  missWall: 15,
  /** Speed lost by a lunge that hits no one, m/s. */
  missSwing: 5,
  /** Seconds a juke window lasts. */
  juke: 0.25,
  /** Deceleration during a juke, m/s². */
  jukeBrake: 30,
  /** On a dodge, speed above the speed before the juke, m/s. */
  jukeBonus: 1.5,
  /** Seconds after starting a juke before the next one. */
  jukeCooldown: 1.5,
};

/** Car j is on the lunge side of car i and beside it, not ahead or behind. */
function target(cars: Cars, track: Track, i: number, j: number, dir: number): boolean {
  const c = contact(cars, track, i, j);
  return c !== null && c.nx * dir > 0 && Math.abs(c.nx) > Math.abs(c.ns);
}

/** Count a timer down by dt. Snaps float leftovers (15 × 1/60 is not exactly 0.25) to 0. */
function tick(t: number, dt: number): number {
  const left = t - dt;
  return left > 1e-9 ? left : 0;
}

/** Lunge over: no hit. The road edge is the barrier. */
function miss(cars: Cars, i: number, atWall: boolean): void {
  cars.smash[i] = 0;
  cars.v[i] = Math.max(0, cars.v[i]! - (atWall ? SMASH.missWall : SMASH.missSwing));
}

/** Start, run and resolve smashes and jukes. Call after stepPhysics. */
export function stepSmash(cars: Cars, track: Track, inputs: Uint8Array, dt: number): void {
  const S = SMASH;

  // Timers, then new actions. Juke wins if brake and a steer key are both held.
  for (let i = 0; i < cars.count; i++) {
    cars.cooldown[i] = tick(cars.cooldown[i]!, dt);
    cars.jukeCd[i] = tick(cars.jukeCd[i]!, dt);
    cars.juke[i] = tick(cars.juke[i]!, dt);

    const bits = inputs[i]!;
    if ((bits & AGGRO) === 0 || cars.smash[i] !== 0 || cars.juke[i]! > 0) continue;
    const dir = steerDir(bits);
    if (bits & BRAKE) {
      if (cars.jukeCd[i]! > 0) continue;
      cars.juke[i] = S.juke;
      cars.jukeV[i] = cars.v[i]!;
      cars.jukeCd[i] = S.jukeCooldown;
    } else if (dir !== 0 && cars.cooldown[i]! <= 0) {
      cars.smash[i] = dir * S.lunge;
      cars.cooldown[i] = S.cooldown;
    }
  }

  // The juke's hard brake, until it dodges something.
  for (let i = 0; i < cars.count; i++) {
    if (cars.juke[i]! > 0 && cars.jukeV[i]! >= 0) {
      cars.v[i] = Math.max(0, cars.v[i]! - S.jukeBrake * dt);
    }
  }

  // Lunges.
  for (let i = 0; i < cars.count; i++) {
    const left = cars.smash[i]!;
    if (left === 0) continue;
    const dir = left > 0 ? 1 : -1;

    const edge = track.width[segmentIndex(track, cars.s[i]!)]! / 2 - TUNING.halfWidth;
    const x = cars.x[i]! + dir * S.lungeSpeed * dt;
    cars.x[i] = x > edge ? edge : x < -edge ? -edge : x;

    let hit = false;
    for (let j = 0; j < cars.count && !hit; j++) {
      if (j === i || !target(cars, track, i, j, dir)) continue;
      if (cars.juke[j]! > 0) {
        // Dodged. The juker gets its speed back once, and stays out of reach for the rest of this lunge.
        if (cars.jukeV[j]! >= 0) {
          cars.v[j] = cars.jukeV[j]! + S.jukeBonus;
          cars.jukeV[j] = -1;
        }
        cars.juke[j] = Math.max(cars.juke[j]!, Math.abs(left));
        continue;
      }
      cars.v[j] = Math.max(0, cars.v[j]! - S.hitLoss);
      cars.yaw[j] = cars.yaw[j]! + dir * S.hitYaw;
      cars.v[i] = cars.v[i]! + S.hitBoost;
      cars.smash[i] = 0;
      hit = true;
    }
    if (hit) continue;

    const next = tick(Math.abs(left), dt);
    if (dir * cars.x[i]! >= edge) miss(cars, i, true);
    else if (next === 0) miss(cars, i, false);
    else cars.smash[i] = dir * next;
  }
}
