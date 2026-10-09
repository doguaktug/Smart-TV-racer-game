import { describe, expect, it } from "vitest";
import { PI } from "../sim/dmath";
import { compileTrack, segmentIndex, wrapS } from "./track";
import { testRing } from "./tracks/testRing";

describe("compileTrack", () => {
  const t = compileTrack(testRing);

  it("cuts the lap into 5 m segments", () => {
    expect(t.length).toBe(1800);
    expect(t.count).toBe(360);
  });

  it("stores curvature and width per segment", () => {
    expect(t.curvature[0]).toBe(0); // first straight
    expect(t.curvature[80]).toBeCloseTo(PI / 2 / 150, 12); // first turn
    expect(t.width[0]).toBe(14);
    expect(t.width[220]).toBe(8); // narrow straight starts at 1100 m
    expect(t.width[260]).toBe(14);
  });

  it("starts the centreline at the origin heading north", () => {
    expect(t.px[0]).toBe(0);
    expect(t.py[0]).toBe(0);
    expect(t.py[80]).toBeCloseTo(400, 6);
  });

  it("rejects a lap that does not close", () => {
    const open = { name: "Open", width: 10, sections: [{ length: 100 }, { length: 100, turn: 360 }] };
    expect(() => compileTrack(open)).toThrow(/does not close/);
  });

  it("rejects a lap that ends facing the wrong way", () => {
    const bent = { name: "Bent", width: 10, sections: [{ length: 1, turn: 10 }] };
    expect(() => compileTrack(bent)).toThrow(/wrong way/);
  });

  it("rejects turns tighter than the road width", () => {
    const tight = { name: "Tight", width: 14, sections: [{ length: 20, turn: 360 }] }; // radius ~3 m
    expect(() => compileTrack(tight)).toThrow(/too tight/);
  });

  it("rejects bad section lengths", () => {
    expect(() => compileTrack({ name: "Bad", width: 10, sections: [{ length: 0 }] })).toThrow();
    expect(() => compileTrack({ name: "Empty", width: 10, sections: [] })).toThrow();
  });
});

describe("wrapS / segmentIndex", () => {
  const t = compileTrack(testRing);

  it("wraps distances into one lap", () => {
    expect(wrapS(t, 1800)).toBe(0);
    expect(wrapS(t, -1)).toBe(1799);
    expect(wrapS(t, 3700)).toBe(100);
  });

  it("finds the segment for any distance", () => {
    expect(segmentIndex(t, 0)).toBe(0);
    expect(segmentIndex(t, 7)).toBe(1);
    expect(segmentIndex(t, -1)).toBe(359);
    expect(segmentIndex(t, 1800)).toBe(0);
  });
});
