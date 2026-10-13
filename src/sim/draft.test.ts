import { describe, expect, it } from "vitest";
import { RIGHT } from "./actions";
import { createCars, type Cars } from "./cars";
import { DRAFT, draftTier, findLeader, stepDraft } from "./draft";
import { stepPhysics, TUNING } from "./physics";
import { compileTrack } from "../track/track";
import { testRing } from "../track/tracks/testRing";

const DT = 1 / 60;
const track = compileTrack(testRing);

/**
 * Leader (car 0) at s=17, follower (car 1) 7 m behind (2.5 m bumper gap), both
 * at top speed. `locked` = the pair has already held for DRAFT.lockIn. Cars 2-3 parked far away.
 */
function pair(draftSeconds: number, locked = true): Cars {
  const cars = createCars(4);
  cars.s[0] = 17;
  cars.s[1] = 10;
  cars.v[0] = cars.v[1] = TUNING.topSpeed;
  cars.draft[0] = cars.draft[1] = draftSeconds;
  if (locked) {
    cars.leader[1] = 0;
    cars.lock[1] = DRAFT.lockIn;
  }
  cars.s[2] = cars.s[3] = 1000;
  cars.x[3] = 5;
  return cars;
}

function run(cars: Cars, inputs: Uint8Array, seconds: number): void {
  for (let t = 0; t < seconds * 60; t++) {
    stepPhysics(cars, track, inputs, DT);
    stepDraft(cars, track, inputs, DT);
  }
}

describe("starting the draft", () => {
  it("tiers follow draft time", () => {
    expect(draftTier(0.5)).toBe(0);
    expect(draftTier(1)).toBe(1);
    expect(draftTier(3)).toBe(2);
    expect(draftTier(100)).toBe(3);
  });

  it("finds the car ahead only inside the slipstream", () => {
    const cars = pair(0, false);
    expect(findLeader(cars, track, 1)).toBe(0);
    expect(findLeader(cars, track, 0)).toBe(-1);
    cars.x[1] = DRAFT.halfWidth;
    expect(findLeader(cars, track, 1)).toBe(-1);
  });

  it("only within range, bumper to bumper", () => {
    const cars = pair(0, false);
    cars.s[1] = 17 - 2 * TUNING.halfLength - DRAFT.range; // exactly at range
    expect(findLeader(cars, track, 1)).toBe(0);
    cars.s[1] -= 0.1;
    expect(findLeader(cars, track, 1)).toBe(-1);
  });

  it("works across the finish line", () => {
    const cars = pair(0);
    cars.s[0] = 1;
    cars.s[1] = track.length - 5;
    expect(findLeader(cars, track, 1)).toBe(0);
  });

  it("the pair only counts after the lock-in period", () => {
    const cars = pair(0, false);
    run(cars, new Uint8Array(4), DRAFT.lockIn - 0.1);
    expect(cars.leader[1]).toBe(0);
    expect(cars.draft[0]).toBe(0);
    expect(cars.draft[1]).toBe(0);
  });

  it("both cars in the pair build draft time", () => {
    const cars = pair(0, false);
    run(cars, new Uint8Array(4), DRAFT.lockIn + 1.1);
    expect(draftTier(cars.draft[0]!)).toBe(1);
    expect(draftTier(cars.draft[1]!)).toBe(1);
    expect(cars.draft[2]).toBe(0);
  });
});

describe("keeping the draft", () => {
  it("an existing pair only breaks past the margin", () => {
    const cars = pair(0);
    cars.x[1] = DRAFT.halfWidth + DRAFT.margin / 2;
    cars.s[1] = 17 - 2 * TUNING.halfLength - DRAFT.range - DRAFT.margin / 2;
    expect(findLeader(cars, track, 1)).toBe(0);
    cars.x[1] = DRAFT.halfWidth + DRAFT.margin;
    expect(findLeader(cars, track, 1)).toBe(-1);
  });

  it("a tier-3 pair is faster than a lone car and holds its gap", () => {
    const cars = pair(DRAFT.tierTime[2]!);
    cars.s[3] = 17; // lone car beside the leader, out of the slipstream
    cars.v[3] = TUNING.topSpeed;
    run(cars, new Uint8Array(4), 3);
    expect(cars.v[0]).toBeGreaterThan(cars.v[3]! + 2);
    expect(cars.s[0]).toBeGreaterThan(cars.s[3]! + 3);
    expect(cars.s[0]! - cars.s[1]!).toBeCloseTo(7, 6);
  });
});

describe("leaving the draft", () => {
  /** Tier-3 pair where the follower has just pulled out to side offset dx, `bumpers` metres behind. */
  function pulledOut(dx: number, bumpers = 0.2): Cars {
    const cars = pair(DRAFT.tierTime[2]!);
    cars.x[1] = dx;
    cars.s[1] = 17 - 2 * TUNING.halfLength - bumpers;
    return cars;
  }
  const PRESS_DX = (DRAFT.sideMin + DRAFT.sideWidth) / 2;

  it("steering out breaks the pair and both cars lose the bonus", () => {
    const cars = pair(DRAFT.tierTime[2]!);
    const inputs = new Uint8Array(4);
    inputs[1] = RIGHT;
    run(cars, inputs, 0.5);
    expect(Math.abs(cars.x[1]! - cars.x[0]!)).toBeGreaterThanOrEqual(DRAFT.halfWidth);
    inputs[1] = 0;
    run(cars, inputs, DRAFT.tierTime[2]! / DRAFT.drain + 0.1);
    expect(cars.draft[0]).toBe(0);
    expect(cars.draft[1]).toBe(0);
  });

  it("the follower pressing tight beside the leader slows it down", () => {
    const pressed = pulledOut(PRESS_DX);
    const wide = pulledOut(DRAFT.sideWidth + 0.5);
    const inputs = new Uint8Array(4);
    run(pressed, inputs, 1);
    run(wide, inputs, 1);
    expect(pressed.leader[1]).toBe(0);
    expect(wide.leader[1]).toBe(-1);
    expect(pressed.v[0]).toBeLessThan(wide.v[0]! - 2.5);
  });

  it("further back, the follower keeps its link but does not press yet", () => {
    const back = pulledOut(PRESS_DX, 2);
    const wide = pulledOut(DRAFT.sideWidth + 0.5, 2);
    const inputs = new Uint8Array(4);
    run(back, inputs, 0.5);
    run(wide, inputs, 0.5);
    expect(back.leader[1]).toBe(0);
    expect(back.v[0]).toBe(wide.v[0]);
  });

  it("between the slipstream and the leader's side there is no draft and no pressure", () => {
    const between = pulledOut((DRAFT.halfWidth + DRAFT.margin + DRAFT.sideMin) / 2);
    const wide = pulledOut(DRAFT.sideWidth + 0.5);
    const inputs = new Uint8Array(4);
    run(between, inputs, 1);
    run(wide, inputs, 1);
    expect(between.draft[1]).toBe(wide.draft[1]);
    expect(between.v[0]).toBe(wide.v[0]);
  });

  it("the pressure stops side by side, and the follower gets past", () => {
    const cars = pulledOut(PRESS_DX);
    run(cars, new Uint8Array(4), 5);
    expect(cars.s[1]! - cars.s[0]!).toBeGreaterThan(2 * TUNING.halfLength);
    expect(cars.leader[1]).toBe(-1);
  });

  it("a car that never drafted the leader puts no pressure on it", () => {
    const cars = pulledOut(-5); // follower gone wide on the other side
    const control = pulledOut(-5);
    cars.s[3] = cars.s[1]!; // stranger tight beside the leader
    cars.x[3] = PRESS_DX;
    cars.v[3] = control.v[3] = TUNING.topSpeed;
    run(cars, new Uint8Array(4), 1);
    run(control, new Uint8Array(4), 1);
    expect(cars.leader[3]).toBe(-1);
    expect(cars.v[0]).toBe(control.v[0]);
  });
});
