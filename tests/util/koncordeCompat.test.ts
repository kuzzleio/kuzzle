import { Koncorde } from "koncorde";
import { describe, expect, it } from "vitest";

import {
  fromKoncordeIndex,
  koncordeTest,
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

  // The notifier matches every written document through koncordeTest, and a
  // throw there fails the write request itself. koncorde < 4.8.0-beta.2 threw
  // "subfilters is not iterable" once geospatial subscriptions had been
  // removed (its geospatial index kept some of them). Seeded, and the same
  // scenario that reproduced it on 4.7.0.
  it("matches documents after geospatial subscriptions are removed", () => {
    const koncorde = new Koncorde();
    const index = toKoncordeIndex("nyc-open-data", "yellow-taxi");
    let seed = 13;
    const rnd = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const ids: string[] = [];

    for (let i = 0; i < 2000; i++) {
      ids.push(
        koncorde.register(
          {
            geoDistance: {
              distance: `${Math.round(rnd() * 2e6)}m`,
              pos: { lat: rnd() * 170 - 85, lon: rnd() * 358 - 179 },
            },
          },
          index,
        ),
      );
    }

    const removed = new Set<string>();

    for (let i = 0; i < ids.length; i += 2) {
      koncorde.remove(ids[i], index);
      removed.add(ids[i]);
    }

    for (let i = 0; i < 5000; i++) {
      const pos = { lat: rnd() * 170 - 85, lon: rnd() * 358 - 179 };
      const matched = koncordeTest(koncorde, "nyc-open-data", "yellow-taxi", {
        pos,
      });

      expect(matched.filter((id) => removed.has(id))).toEqual([]);
    }
  });
});
