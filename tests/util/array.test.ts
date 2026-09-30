import { describe, expect, it } from "vitest";

import { binarySearch } from "../../lib/util/array";

describe("#array", () => {
  describe("binarySearch", () => {
    it("returns the index of an element found in a sorted array", () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = binarySearch(array, (value) => 4 - value);

      expect(result).toEqual(3);
    });

    it("returns -1 when no element is found in a sorted array", () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = binarySearch(array, (value) => 0 - value);

      expect(result).toEqual(-1);
    });
  });
});
