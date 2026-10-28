import { describe, expect, it, vi } from "vitest";

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

    it("finds the single element of a one-element array, or answers -1", () => {
      expect(binarySearch(["a"], (value) => "a".localeCompare(value))).toBe(0);
      expect(binarySearch(["a"], (value) => "b".localeCompare(value))).toBe(-1);
    });

    it("answers -1 on reaching a hole instead of calling the predicate", () => {
      const predicate = vi.fn((value: number) => 4 - value);
      const sparse: number[] = new Array(3);
      sparse[0] = 1;
      sparse[2] = 3;

      const result = binarySearch(sparse, predicate);

      expect(result).toBe(-1);
      expect(predicate).not.toHaveBeenCalled();
    });
  });
});
