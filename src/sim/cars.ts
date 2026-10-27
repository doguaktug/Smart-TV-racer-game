// Car state as struct-of-arrays: one typed array per field, all of them views
// into a single buffer. Allocated once per race, so the tick never creates
// garbage, and a rollback snapshot is a single buffer copy.

export const MIN_CARS = 4;
export const MAX_CARS = 8;

const FIELD_COUNT = 15;

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
  /** Completed laps. -1 on the grid, before the first crossing of the line. */
  readonly lap: Float64Array;
  /** Seconds of draft built up, capped at the top tier. Drains when out of the draft. */
  readonly draft: Float64Array;
  /** Index of the car whose slipstream this one is in (or, after a locked-in pair, is still pressing beside). -1 = none. */
  readonly leader: Float64Array;
  /** Seconds spent in the current leader's slipstream. The pair counts once this reaches DRAFT.lockIn. */
  readonly lock: Float64Array;
  /** Extra turn rate from being hit, rad/s. Fades to 0. */
  readonly yaw: Float64Array;
  /** Seconds of smash lunge left, signed: + = right, - = left, 0 = not smashing. */
  readonly smash: Float64Array;
  /** Seconds until this car may smash again. */
  readonly cooldown: Float64Array;
  /** Seconds of juke window left, 0 = not juking. */
  readonly juke: Float64Array;
  /** Speed when the juke started, m/s. -1 = this juke already dodged a smash. */
  readonly jukeV: Float64Array;
  /** Seconds until this car may juke again. */
  readonly jukeCd: Float64Array;
  /** Tick on which this car finished the race. -1 = still racing. */
  readonly finish: Float64Array;
}

export function createCars(count: number): Cars {
  if (!Number.isInteger(count) || count < MIN_CARS || count > MAX_CARS) {
    throw new Error(`car count must be ${MIN_CARS}-${MAX_CARS}, got ${count}`);
  }
  const data = new Float64Array(FIELD_COUNT * count);
  const field = (i: number) => data.subarray(i * count, (i + 1) * count);
  const cars = {
    count,
    data,
    s: field(0),
    x: field(1),
    v: field(2),
    heading: field(3),
    lap: field(4),
    draft: field(5),
    leader: field(6),
    lock: field(7),
    yaw: field(8),
    smash: field(9),
    cooldown: field(10),
    juke: field(11),
    jukeV: field(12),
    jukeCd: field(13),
    finish: field(14),
  };
  cars.leader.fill(-1);
  cars.finish.fill(-1);
  return cars;
}

/** Overwrite dst with src. Used to take and restore rollback snapshots. */
export function copyCars(dst: Cars, src: Cars): void {
  if (dst.count !== src.count) throw new Error("copyCars: count mismatch");
  dst.data.set(src.data);
}
