import { describe, expect, it } from "vitest";
import { AGGRO, BRAKE, LEFT, RIGHT } from "./actions";
import { contact } from "./collide";
import { createRace, DT, progress, RACE, raceOver, stepRace, type Race } from "./race";
import { compileTrack } from "../track/track";
import { testRing } from "../track/tracks/testRing";

const track = compileTrack(testRing);
const COUNTDOWN = RACE.countdown * RACE.tickRate;

function run(race: Race, ticks: number, inputs = new Uint8Array(race.cars.count)): void {
  for (let t = 0; t < ticks; t++) stepRace(race, inputs);
}

describe("grid", () => {
  it("places every car behind the line, on the road, not touching", () => {
    const race = createRace(track, 8, 3);
    for (let i = 0; i < 8; i++) {
      expect(progress(race, i)).toBeLessThan(0);
      expect(race.cars.v[i]).toBe(0);
      for (let j = i + 1; j < 8; j++) expect(contact(race.cars, track, i, j)).toBeNull();
    }
    expect(Array.from(race.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("rejects a race with no laps", () => {
    expect(() => createRace(track, 4, 0)).toThrow();
  });
});

describe("stepRace", () => {
  it("holds every car still during the countdown", () => {
    const race = createRace(track, 4, 1);
    const before = race.cars.data.slice();
    run(race, COUNTDOWN, new Uint8Array(4).fill(RIGHT));
    expect(race.cars.data).toEqual(before);
    run(race, 1);
    expect(race.cars.v[0]).toBeGreaterThan(0);
  });

  it("counts the first crossing of the line as lap 0", () => {
    const race = createRace(track, 4, 3);
    run(race, COUNTDOWN + RACE.tickRate * 2);
    for (let i = 0; i < 4; i++) expect(race.cars.lap[i]).toBe(0);
  });

  it("re-orders when a car falls back", () => {
    // Pole sits still; car 1 in the other column has a free road past it.
    const race = createRace(track, 4, 3);
    const inputs = new Uint8Array(4);
    inputs[0] = BRAKE;
    run(race, COUNTDOWN + RACE.tickRate * 3, inputs);
    expect(race.order[0]).toBe(1);
    expect(race.order.indexOf(0)).toBeGreaterThan(0);
  });

  it("finishes in order and keeps the order once finished", () => {
    const race = createRace(track, 4, 1);
    run(race, COUNTDOWN);
    let ticks = 0;
    while (!raceOver(race) && ticks++ < 200 * RACE.tickRate) run(race, 1);
    expect(raceOver(race)).toBe(true);
    const finish = Array.from(race.order, (i) => race.cars.finish[i]!);
    expect(finish).toEqual([...finish].sort((a, b) => a - b));

    // Car 3 brakes to a stop after the flag; its place does not change.
    const placed = Array.from(race.order);
    const inputs = new Uint8Array(4);
    inputs[placed[0]!] = BRAKE;
    run(race, 10 * RACE.tickRate, inputs);
    expect(Array.from(race.order)).toEqual(placed);
  });

  it("is deterministic: same inputs, same bits", () => {
    const a = createRace(track, 8, 2);
    const b = createRace(track, 8, 2);
    const inputs = new Uint8Array(8);
    for (let t = 0; t < COUNTDOWN + 20 * RACE.tickRate; t++) {
      // A busy, repeatable input pattern: steering, braking, smashes, jukes.
      for (let i = 0; i < 8; i++) inputs[i] = ((t * 7 + i * 13) >> 4) & (LEFT | RIGHT | BRAKE | AGGRO);
      stepRace(a, inputs);
      stepRace(b, inputs);
    }
    expect(a.cars.data).toEqual(b.cars.data);
    expect(a.tick * DT).toBeCloseTo(RACE.countdown + 20);
  });
});
