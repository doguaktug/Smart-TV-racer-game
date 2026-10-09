import { describe, expect, it } from "vitest";
import { copyCars, createCars } from "./cars";

describe("cars", () => {
  it("rejects counts outside 4-8", () => {
    expect(() => createCars(3)).toThrow();
    expect(() => createCars(9)).toThrow();
    expect(createCars(8).count).toBe(8);
  });

  it("fields are views into one shared buffer", () => {
    const cars = createCars(4);
    expect(cars.s.length).toBe(4);
    cars.x[2] = 1.5;
    expect(cars.data).toContain(1.5);
  });

  it("snapshot and restore with copyCars", () => {
    const live = createCars(4);
    const snap = createCars(4);
    live.v[0] = 30;
    copyCars(snap, live);
    live.v[0] = 99;
    copyCars(live, snap);
    expect(live.v[0]).toBe(30);
  });
});
