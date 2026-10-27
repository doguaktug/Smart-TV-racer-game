import { describe, expect, it } from "vitest";
import { AGGRO, BRAKE, LEFT, RIGHT } from "./actions";
import { createCars, type Cars } from "./cars";
import { stepPhysics, TUNING } from "./physics";
import { SMASH, stepSmash } from "./smash";
import { compileTrack } from "../track/track";
import { testRing } from "../track/tracks/testRing";

const DT = 1 / 60;
const track = compileTrack(testRing);
const NARROW = 1250; // metres; inside the 8 m straight
const W = TUNING.halfWidth;

/** Cars 0 and 1 side by side at s, 1 m of air between them, both at 40 m/s. Others far away. */
function pair(s = 100, x0 = -1.5): Cars {
  const cars = createCars(4);
  for (let k = 0; k < 4; k++) cars.s[k] = 200 + 50 * k;
  cars.s[0] = cars.s[1] = s;
  cars.x[0] = x0;
  cars.x[1] = x0 + 2 * W + 1;
  cars.v.fill(40);
  return cars;
}

/** Run smash only (no physics) for n ticks. bits[k] is held by car k on the first tick only. */
function run(cars: Cars, bits: number[], ticks: number): void {
  const inputs = new Uint8Array(cars.count);
  for (let t = 0; t < ticks; t++) {
    bits.forEach((b, k) => (inputs[k] = t === 0 ? b : 0));
    stepSmash(cars, track, inputs, DT);
  }
}

describe("smash", () => {
  it("hits a car beside it: target slows and turns, smasher gains", () => {
    const cars = pair();
    run(cars, [AGGRO | RIGHT], 20);
    expect(cars.v[1]).toBeCloseTo(40 - SMASH.hitLoss, 9);
    expect(cars.yaw[1]).toBeCloseTo(SMASH.hitYaw, 9);
    expect(cars.v[0]).toBeCloseTo(40 + SMASH.hitBoost, 9);
    expect(cars.smash[0]).toBe(0);
    expect(cars.cooldown[0]).toBeGreaterThan(0);
  });

  it("does not hit a car behind it", () => {
    const cars = pair();
    cars.s[1] = 100 - 2 * TUNING.halfLength + 0.1; // overlaps the rear bumper only
    cars.x[1] = cars.x[0]! + 0.5;
    run(cars, [AGGRO | RIGHT], 30);
    expect(cars.v[1]).toBe(40);
  });

  it("swinging at air costs missSwing", () => {
    const cars = pair();
    run(cars, [AGGRO | LEFT], 30); // car 1 is to the right
    expect(cars.v[0]).toBeCloseTo(40 - SMASH.missSwing, 9);
    expect(cars.smash[0]).toBe(0);
  });

  it("lunging into the barrier costs missWall", () => {
    const cars = pair(NARROW, -1.5);
    run(cars, [AGGRO | LEFT], 30); // edge at -3 m, lunge reaches it
    expect(cars.x[0]).toBe(-(8 / 2 - W));
    expect(cars.v[0]).toBeCloseTo(40 - SMASH.missWall, 9);
  });

  it("locks steering during the lunge", () => {
    const cars = pair();
    const inputs = new Uint8Array(cars.count);
    inputs[0] = AGGRO | LEFT;
    stepSmash(cars, track, inputs, DT);
    inputs[0] = RIGHT;
    stepPhysics(cars, track, inputs, DT);
    expect(cars.heading[0]).toBe(0);
  });

  it("respects the cooldown", () => {
    const cars = pair();
    run(cars, [AGGRO | LEFT], 30);
    run(cars, [AGGRO | LEFT], 1);
    expect(cars.smash[0]).toBe(0);
  });
});

describe("juke", () => {
  it("dodges a smash: smasher misses, juker gets its speed back plus a bonus", () => {
    const cars = pair();
    run(cars, [AGGRO | RIGHT, AGGRO | BRAKE], 30);
    expect(cars.v[1]).toBeCloseTo(40 + SMASH.jukeBonus, 9);
    expect(cars.yaw[1]).toBe(0);
    expect(cars.v[0]).toBeCloseTo(40 - SMASH.missSwing, 9);
  });

  it("with nothing to dodge, it is just a hard brake", () => {
    const cars = pair();
    run(cars, [0, AGGRO | BRAKE], 30);
    expect(cars.v[1]).toBeCloseTo(40 - SMASH.jukeBrake * SMASH.juke, 6);
  });

  it("is too late once the window has closed", () => {
    const cars = pair();
    run(cars, [0, AGGRO | BRAKE], 20); // window over
    run(cars, [AGGRO | RIGHT], 20);
    expect(cars.v[1]).toBeLessThan(40 - SMASH.hitLoss);
  });

  it("ignores brake from physics while aggression is held", () => {
    const cars = pair();
    const inputs = new Uint8Array(cars.count);
    inputs[1] = AGGRO | BRAKE;
    stepPhysics(cars, track, inputs, DT);
    expect(cars.v[1]).toBeGreaterThan(40);
  });
});
