// One race: the fixed 60 Hz tick that runs every rule in order, plus the
// starting grid, the countdown, laps, finishing and the running order.
//
// Tick order: physics (move) → draft (speed) → smash (lunges, jukes) →
// collisions (keep cars apart). Collisions go last so nothing ends the tick
// inside another car. Everything a rollback needs is race.tick + cars.data.

import { createCars, type Cars } from "./cars";
import { stepCollisions } from "./collide";
import { stepDraft } from "./draft";
import { stepPhysics, TUNING } from "./physics";
import { stepSmash } from "./smash";
import { segmentIndex, wrapS, type Track } from "../track/track";

export const RACE = {
  /** Ticks per second. */
  tickRate: 60,
  /** Seconds before the start during which nothing moves. */
  countdown: 3,
  /** Gap from the front car's front bumper to the line, metres. */
  lineGap: 1,
  /** Centre to centre, one grid row to the next, metres. */
  rowGap: 8,
  /** Side offset of the two grid columns from the centreline, metres. */
  column: 3,
  /** The right column sits this much further back than the left, metres. */
  stagger: 4,
};

/** Seconds per tick. */
export const DT = 1 / RACE.tickRate;

export interface Race {
  readonly track: Track;
  readonly cars: Cars;
  /** Laps to finish. */
  readonly laps: number;
  /** Ticks since the race was created, countdown included. */
  tick: number;
  /** Per car: bit j set if it touched car j this tick (from stepCollisions). */
  readonly hits: Uint8Array;
  /** Car indices, leader first. Refreshed every tick. */
  readonly order: Uint8Array;
}

/** A race with the cars on the grid, car 0 on pole. */
export function createRace(track: Track, count: number, laps: number): Race {
  if (!Number.isInteger(laps) || laps < 1) throw new Error(`laps must be a positive integer, got ${laps}`);
  const cars = createCars(count);
  const race = { track, cars, laps, tick: 0, hits: new Uint8Array(count), order: new Uint8Array(count) };
  placeGrid(race);
  return race;
}

/** Two staggered columns behind the line (s = 0), standing still, lap -1. */
function placeGrid(race: Race): void {
  const { cars, track } = race;
  for (let i = 0; i < cars.count; i++) {
    const right = i & 1;
    const back = TUNING.halfLength + RACE.lineGap + (i >> 1) * RACE.rowGap + right * RACE.stagger;
    const s = wrapS(track, -back);
    const edge = track.width[segmentIndex(track, s)]! / 2 - TUNING.halfWidth;
    cars.s[i] = s;
    cars.x[i] = Math.min(edge, RACE.column) * (right ? 1 : -1);
    cars.lap[i] = -1;
  }
  updateOrder(race);
}

/** True once the countdown is over. */
export function started(race: Race): boolean {
  return race.tick >= RACE.countdown * RACE.tickRate;
}

/** Distance covered since the line, counting laps. Negative on the grid. */
export function progress(race: Race, i: number): number {
  return race.cars.lap[i]! * race.track.length + race.cars.s[i]!;
}

/** Car a is ahead of car b: finished first, else further along, else lower index. */
function ahead(race: Race, a: number, b: number): boolean {
  const fa = race.cars.finish[a]!;
  const fb = race.cars.finish[b]!;
  if (fa !== fb) {
    if (fa < 0) return false;
    if (fb < 0) return true;
    return fa < fb;
  }
  const pa = progress(race, a);
  const pb = progress(race, b);
  return pa !== pb ? pa > pb : a < b;
}

/** Re-sort race.order. Insertion sort: no garbage, and nearly sorted every tick. */
export function updateOrder(race: Race): void {
  const order = race.order;
  for (let i = 0; i < order.length; i++) order[i] = i;
  for (let i = 1; i < order.length; i++) {
    const car = order[i]!;
    let j = i - 1;
    while (j >= 0 && ahead(race, car, order[j]!)) {
      order[j + 1] = order[j]!;
      j--;
    }
    order[j + 1] = car;
  }
}

/** Every car has finished. */
export function raceOver(race: Race): boolean {
  for (let i = 0; i < race.cars.count; i++) if (race.cars.finish[i]! < 0) return false;
  return true;
}

/** Advance the race one tick. inputs[i] = action bits for car i. */
export function stepRace(race: Race, inputs: Uint8Array): void {
  const { cars, track } = race;
  if (started(race)) {
    stepPhysics(cars, track, inputs, DT);
    stepDraft(cars, track, inputs, DT);
    stepSmash(cars, track, inputs, DT);
    stepCollisions(cars, track, race.hits);
    // Finished cars keep driving, but their place is fixed.
    for (let i = 0; i < cars.count; i++) {
      if (cars.finish[i]! < 0 && cars.lap[i]! >= race.laps) cars.finish[i] = race.tick;
    }
  }
  race.tick++;
  updateOrder(race);
}
