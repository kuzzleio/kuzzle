import { describe, expect, it } from "vitest";

import {
  fromKoncordeIndex,
  toKoncordeIndex,
} from "../../lib/util/koncordeCompat";

describe("#koncordeCompat", () => {
  it("round-trips an index/collection pair", () => {
    expect(fromKoncordeIndex(toKoncordeIndex("nyc-open-data", "yellow-taxi"))) //
      .toEqual({ collection: "yellow-taxi", index: "nyc-open-data" });
  });

  // Two of the three callers read the name off a cluster message payload, so a
  // name with no separator is remote input, not a hypothetical. It used to
  // yield `{ collection: undefined }` and leave the next reader to trip over it.
  it("rejects a name that is not a Koncorde v4 index", () => {
    expect(() => fromKoncordeIndex("nyc-open-data")).toThrow(
      /is not a Koncorde index/,
    );
  });
});
