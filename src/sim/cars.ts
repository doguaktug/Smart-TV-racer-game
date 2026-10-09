// Car state as struct-of-arrays: one typed array per field, all of them views
// into a single buffer. Allocated once per race, so the tick never creates
// garbage, and a rollback snapshot is a single buffer copy.

export const MIN_CARS = 4;
export const MAX_CARS = 8;

const FIELD_COUNT = 5;

export interface Cars {
  readonly count: number;
  /** Every field below lives in this buffer. */
  readonly data: Float64Array;
  /** Distance along the track centreline, metres, in [0, track.length). */
  readonly s: Float64Array;
  /** Side offset from the centreline, metres. Negative = left, positive = right. */
  readonly x: Float64Array;
  /** Speed along the car's heading, m/s. */
  readonly v: Float64Array;
  /** Heading relative to the road direction, radians. 0 = straight down the road, + = right. */
  readonly heading: Float64Array;
  /** Completed laps. */
  readonly lap: Float64Array;
}

export function createCars(count: number): Cars {
  if (!Number.isInteger(count) || count < MIN_CARS || count > MAX_CARS) {
    throw new Error(`car count must be ${MIN_CARS}-${MAX_CARS}, got ${count}`);
  }
  const data = new Float64Array(FIELD_COUNT * count);
  const field = (i: number) => data.subarray(i * count, (i + 1) * count);
  return {
    count,
    data,
    s: field(0),
    x: field(1),
    v: field(2),
    heading: field(3),
    lap: field(4),
  };
}

/** Overwrite dst with src. Used to take and restore rollback snapshots. */
export function copyCars(dst: Cars, src: Cars): void {
  if (dst.count !== src.count) throw new Error("copyCars: count mismatch");
  dst.data.set(src.data);
}
