import type { TrackDef } from "../track";

/** Rounded rectangle, 1800 m. One narrow straight to test road-width rules. */
export const testRing: TrackDef = {
  name: "Test Ring",
  width: 14,
  sections: [
    { length: 400 },
    { length: 150, turn: 90 },
    { length: 200 },
    { length: 150, turn: 90 },
    { length: 200 },
    { length: 200, width: 8 },
    { length: 150, turn: 90 },
    { length: 200 },
    { length: 150, turn: 90 },
  ],
};
