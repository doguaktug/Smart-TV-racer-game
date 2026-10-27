import { describe, expect, it } from "vitest";
import { createCars, type Cars } from "./cars";
import { contact, COLLIDE, stepCollisions } from "./collide";
import { TUNING } from "./physics";
import { compileTrack } from "../track/track";
import { testRing } from "../track/tracks/testRing";

const track = compileTrack(testRing);
const L = TUNING.halfLength;
const W = TUNING.halfWidth;
const EDGE = 14 / 2 - W; // first straight is 14 m wide

/** Place car k at (s, x) with speed v, pointing down the road. */
function put(cars: Cars, k: number, s: number, x: number, v = 0): void {
  cars.s[k] = s;
  cars.x[k] = x;
  cars.v[k] = v;
}

/** Spread every car out so only the ones a test places can touch. */
function spread(cars: Cars): void {
  for (let k = 0; k < cars.count; k++) put(cars, k, 200 + 50 * k, 0);
}

function setup(): { cars: Cars; hits: Uint8Array } {
  const cars = createCars(4);
  spread(cars);
  return { cars, hits: new Uint8Array(cars.count) };
}

describe("contact", () => {
  it("returns null for cars far apart", () => {
    const { cars } = setup();
    put(cars, 0, 100, 0);
    put(cars, 1, 120, 0);
    expect(contact(cars, track, 0, 1)).toBeNull();
  });

  it("returns null for cars close but not overlapping", () => {
    const { cars } = setup();
    put(cars, 0, 100, 0);
    put(cars, 1, 100 + 2 * L + 0.1, 0); // nose to tail, 10 cm gap
    expect(contact(cars, track, 0, 1)).toBeNull();
    put(cars, 1, 100, 2 * W + 0.1); // side by side, 10 cm gap
    expect(contact(cars, track, 0, 1)).toBeNull();
  });

  it("finds depth and a forward normal for a rear-end overlap", () => {
    const { cars } = setup();
    put(cars, 0, 100, 0);
    put(cars, 1, 100 + 2 * L - 0.2, 0);
    const c = contact(cars, track, 0, 1)!;
    expect(c).not.toBeNull();
    expect(c.depth).toBeCloseTo(0.2, 9);
    expect(c.ns).toBeCloseTo(1, 9);
    expect(c.nx).toBeCloseTo(0, 9);
  });

  it("finds a sideways normal for a side-by-side overlap", () => {
    const { cars } = setup();
    put(cars, 0, 100, 0);
    put(cars, 1, 100, -(2 * W - 0.3)); // car 1 to the left
    const c = contact(cars, track, 0, 1)!;
    expect(c.depth).toBeCloseTo(0.3, 9);
    expect(c.ns).toBeCloseTo(0, 9);
    expect(c.nx).toBeCloseTo(-1, 9);
  });

  it("sees cars touching across the start/finish line", () => {
    const { cars } = setup();
    put(cars, 0, track.length - 2, 0);
    put(cars, 1, 2 * L - 2.2, 0); // 0.2 m overlap across s = 0
    const c = contact(cars, track, 0, 1)!;
    expect(c).not.toBeNull();
    expect(c.depth).toBeCloseTo(0.2, 9);
    expect(c.ns).toBeCloseTo(1, 9);
  });
});

describe("stepCollisions", () => {
  it("bounces a rear-end hit: back car slows, front car speeds up", () => {
    const { cars, hits } = setup();
    put(cars, 0, 100, 0, 40);
    put(cars, 1, 100 + 2 * L - 0.2, 0, 30);
    stepCollisions(cars, track, hits);
    const J = ((1 + COLLIDE.restitution) * 10) / 2;
    expect(cars.v[0]).toBeCloseTo(40 - J, 9);
    expect(cars.v[1]).toBeCloseTo(30 + J, 9);
    expect(cars.s[1]! - cars.s[0]!).toBeCloseTo(2 * L, 9); // pushed apart, just touching
  });

  it("pushes overlapping cars apart but leaves speed alone when separating", () => {
    const { cars, hits } = setup();
    put(cars, 0, 100, 0, 30);
    put(cars, 1, 100 + 2 * L - 0.2, 0, 40);
    stepCollisions(cars, track, hits);
    expect(cars.v[0]).toBe(30);
    expect(cars.v[1]).toBe(40);
    expect(cars.s[1]! - cars.s[0]!).toBeCloseTo(2 * L, 9);
  });

  it("never makes a car go backwards", () => {
    const { cars, hits } = setup();
    // Car 0 slams into a stopped car 1 at a sharp angle.
    put(cars, 0, 100, 0, 60);
    put(cars, 1, 100 + 2 * L - 0.2, 0, 0);
    cars.heading[0] = 0.6;
    stepCollisions(cars, track, hits);
    expect(cars.v[0]).toBeGreaterThanOrEqual(0);
    expect(cars.v[1]).toBeGreaterThan(0);
  });

  it("does not spin cars on a centred hit", () => {
    const { cars, hits } = setup();
    put(cars, 0, 100, 0, 40);
    put(cars, 1, 100 + 2 * L - 0.2, 0, 30);
    stepCollisions(cars, track, hits);
    expect(cars.yaw[0]).toBeCloseTo(0, 12);
    expect(cars.yaw[1]).toBeCloseTo(0, 12);
  });

  it("spins the hit car on an off-centre hit, mirrored left/right", () => {
    const right = setup();
    put(right.cars, 0, 100, 0, 40);
    put(right.cars, 1, 100 + 2 * L - 0.2, 0.5, 30); // front car offset right
    stepCollisions(right.cars, track, right.hits);

    const left = setup();
    put(left.cars, 0, 100, 0, 40);
    put(left.cars, 1, 100 + 2 * L - 0.2, -0.5, 30);
    stepCollisions(left.cars, track, left.hits);

    // Shoved on its rear-left, the front car's nose swings right (+).
    expect(right.cars.yaw[1]).toBeGreaterThan(0);
    expect(left.cars.yaw[1]).toBeCloseTo(-right.cars.yaw[1]!, 12);
    expect(left.cars.yaw[0]).toBeCloseTo(-right.cars.yaw[0]!, 12);
  });

  it("keeps a car pushed into the wall on the road", () => {
    const { cars, hits } = setup();
    put(cars, 0, 100, EDGE - 0.1);
    put(cars, 1, 100, EDGE - 0.1 - (2 * W - 0.5)); // overlaps from the left
    stepCollisions(cars, track, hits);
    expect(cars.x[0]).toBeLessThanOrEqual(EDGE);
    expect(cars.x[1]).toBeGreaterThanOrEqual(-EDGE);
  });

  it("sets hit bits for both cars and clears them next tick", () => {
    const { cars, hits } = setup();
    put(cars, 0, 100, 0);
    put(cars, 2, 100 + 2 * L - 0.2, 0);
    stepCollisions(cars, track, hits);
    expect(Array.from(hits)).toEqual([1 << 2, 0, 1 << 0, 0]);

    put(cars, 2, 150, 0); // drive apart
    stepCollisions(cars, track, hits);
    expect(Array.from(hits)).toEqual([0, 0, 0, 0]);
  });
});
