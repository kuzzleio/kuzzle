"use strict";

const should = require("should");

const { binarySearch } = require("../../lib/util/array");

describe("#array", () => {
  describe("binarySearch", () => {
    it("should return the index of an element found in a sorted array", () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = binarySearch(array, (value) => 4 - value);

      should(result).be.eql(3);
    });

    it("should return -1 when no element is found in a sorted array", () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = binarySearch(array, (value) => 0 - value);

      should(result).be.eql(-1);
    });
  });
});
