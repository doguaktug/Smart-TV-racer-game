import { describe, expect, it } from "vitest";
import { approach, clamp, dcos, dsin, PI, Rng, TAU } from "./dmath";

describe("dsin / dcos", () => {
  it("matches Math.sin/cos closely over several turns", () => {
    for (let x = -3 * TAU; x <= 3 * TAU; x += 0.0137) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-8);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-8);
    }
  });

  it("hits key values", () => {
    expect(dsin(0)).toBe(0);
    expect(dsin(PI / 2)).toBeCloseTo(1, 9);
    expect(dcos(0)).toBeCloseTo(1, 9);
    expect(dcos(PI)).toBeCloseTo(-1, 9);
  });

  it("is odd: sin(-x) = -sin(x)", () => {
    for (const x of [0.1, 0.7, 1.3, 2.9, 5.5]) {
      expect(dsin(-x)).toBe(-dsin(x));
    }
  });
});

describe("clamp / approach", () => {
  it("clamps", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("approaches without overshoot", () => {
    expect(approach(0, 10, 3)).toBe(3);
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(10, 0, 4)).toBe(6);
    expect(approach(1, 0, 4)).toBe(0);
    expect(approach(5, 5, 1)).toBe(5);
  });
});

describe("Rng", () => {
  it("same seed gives same sequence", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it("restoring state replays the sequence (rollback)", () => {
    const r = new Rng(7);
    r.next();
    const saved = r.state;
    const first = [r.next(), r.next(), r.next()];
    r.state = saved;
    expect([r.next(), r.next(), r.next()]).toEqual(first);
  });

  it("stays in range", () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(8);
      expect(Number.isInteger(n) && n >= 0 && n < 8).toBe(true);
    }
  });
});
