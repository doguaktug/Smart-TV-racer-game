import { describe, expect, it } from "vitest";
import { BRAKE, LEFT, RIGHT } from "./actions";
import { createCars, type Cars } from "./cars";
import { stepPhysics, TUNING } from "./physics";
import { compileTrack } from "../track/track";
import { testRing } from "../track/tracks/testRing";

const DT = 1 / 60;
const track = compileTrack(testRing);
const FIRST_TURN = 400; // metres; right turn, radius ~95 m

/** Run car 0 for `seconds` with a fixed input. Other cars sit idle. */
function run(cars: Cars, bits: number, seconds: number): void {
  const inputs = new Uint8Array(cars.count);
  inputs[0] = bits;
  for (let t = 0; t < seconds * 60; t++) stepPhysics(cars, track, inputs, DT);
}

describe("speed", () => {
  it("accelerates automatically, fading toward top speed", () => {
    const cars = createCars(4);
    run(cars, 0, 5); // still on the first straight
    // v(t) = top * (1 - e^(-t / tau)), tau = top / accel = 5 s
    expect(cars.v[0]).toBeCloseTo(TUNING.topSpeed * (1 - Math.exp(-1)), 0);
  });

  it("never exceeds top speed", () => {
    const cars = createCars(4);
    cars.v[0] = TUNING.topSpeed - 0.01;
    run(cars, 0, 2);
    expect(cars.v[0]).toBeLessThanOrEqual(TUNING.topSpeed);
  });

  it("brakes and never goes negative", () => {
    const cars = createCars(4);
    cars.v[0] = 40;
    run(cars, BRAKE, 1);
    expect(cars.v[0]).toBeCloseTo(40 - TUNING.brake, 6);
    run(cars, BRAKE, 5);
    expect(cars.v[0]).toBe(0);
  });
});

describe("steering", () => {
  it("moves right and left on a straight", () => {
    const a = createCars(4);
    const b = createCars(4);
    a.v[0] = b.v[0] = 30;
    run(a, RIGHT, 0.5);
    run(b, LEFT, 0.5);
    expect(a.x[0]).toBeGreaterThan(0.5);
    expect(b.x[0]).toBeCloseTo(-a.x[0]!, 9);
  });

  it("straightens out when hands-off", () => {
    const cars = createCars(4);
    cars.v[0] = 30;
    cars.heading[0] = 0.3;
    run(cars, 0, 1);
    expect(cars.heading[0]).toBe(0);
  });

  it("stops at the road edge and scrubs speed", () => {
    const cars = createCars(4);
    const free = createCars(4);
    cars.v[0] = free.v[0] = 50;
    run(cars, RIGHT, 3);
    run(free, 0, 3);
    expect(cars.x[0]).toBe(14 / 2 - TUNING.halfWidth);
    expect(cars.v[0]).toBeLessThan(free.v[0]! - 5);
  });
});

describe("corners", () => {
  it("at top speed, a car cannot hold the turn and drifts outside", () => {
    const cars = createCars(4);
    cars.s[0] = FIRST_TURN;
    cars.v[0] = 60;
    run(cars, RIGHT, 1);
    expect(cars.x[0]).toBeLessThan(-3); // right turn: outside is left
  });

  it("at low speed, steering into the turn moves the car inside", () => {
    const cars = createCars(4);
    cars.s[0] = FIRST_TURN;
    cars.v[0] = 15;
    run(cars, RIGHT, 1);
    expect(cars.x[0]).toBeGreaterThan(0);
  });

  it("the inside line covers the turn in less time", () => {
    const inside = createCars(4);
    const outside = createCars(4);
    for (const c of [inside, outside]) {
      c.s[0] = FIRST_TURN;
      c.v[0] = 30;
    }
    inside.x[0] = 4;
    outside.x[0] = -4;
    run(inside, BRAKE, 0.5); // brake = no accel, so both lose speed the same way
    run(outside, BRAKE, 0.5);
    expect(inside.s[0]).toBeGreaterThan(outside.s[0]!);
  });
});

describe("laps", () => {
  it("wraps s and counts a lap at the finish line", () => {
    const cars = createCars(4);
    cars.s[0] = track.length - 1;
    cars.v[0] = 60;
    run(cars, 0, 0.1);
    expect(cars.lap[0]).toBe(1);
    expect(cars.s[0]).toBeLessThan(10);
  });
});
