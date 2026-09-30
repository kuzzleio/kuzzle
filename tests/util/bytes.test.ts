import { describe, expect, it } from "vitest";

import bytes from "../../lib/util/bytes";

describe("#bytes", () => {
  describe("non-string input", () => {
    it("returns a number unchanged", () => {
      expect(bytes(0)).toBe(0);
      expect(bytes(1024)).toBe(1024);
      expect(bytes(-5)).toBe(-5);
      expect(bytes(1.5)).toBe(1.5);
    });

    it("returns null for anything that is neither a number nor a string", () => {
      expect(bytes(null)).toBeNull();
      expect(bytes(undefined)).toBeNull();
      expect(bytes(true)).toBeNull();
      expect(bytes({})).toBeNull();
      expect(bytes([])).toBeNull();
    });
  });

  describe("unit suffixes", () => {
    it("treats a unit-less string as a byte count", () => {
      expect(bytes("1024")).toBe(1024);
    });

    it("applies each binary unit", () => {
      expect(bytes("1kb")).toBe(1024);
      expect(bytes("1mb")).toBe(1024 ** 2);
      expect(bytes("1gb")).toBe(1024 ** 3);
      expect(bytes("1tb")).toBe(1024 ** 4);
    });

    it("is case-insensitive on the unit", () => {
      expect(bytes("2KB")).toBe(2 * 1024);
      expect(bytes("2Mb")).toBe(2 * 1024 ** 2);
      expect(bytes("2gB")).toBe(2 * 1024 ** 3);
    });

    it("accepts a separator between the digits and the unit", () => {
      expect(bytes("512 kb")).toBe(512 * 1024);
    });
  });

  describe("strings with no digits", () => {
    it("returns null", () => {
      expect(bytes("")).toBeNull();
      expect(bytes("kb")).toBeNull();
      expect(bytes("a lot")).toBeNull();
    });
  });

  describe("documented quirks", () => {
    // These are not obviously desirable, but they are the current behaviour of
    // a function that parses configuration values, so they are pinned here
    // rather than left to be discovered by a config change.

    it("ignores a leading minus sign — the digit scan drops it", () => {
      expect(bytes("-1kb")).toBe(1024);
    });

    it("keeps only the first run of digits, ignoring the rest", () => {
      expect(bytes("12kb34")).toBe(12 * 1024);
      // Exponent notation is not understood: "1e3" parses as 1.
      expect(bytes("1e3")).toBe(1);
    });

    it("takes the first matching unit in kb/mb/gb/tb order, not the last", () => {
      expect(bytes("1kbmb")).toBe(1024);
    });

    it("ignores a fractional part", () => {
      expect(bytes("1.5kb")).toBe(1024);
    });
  });
});
