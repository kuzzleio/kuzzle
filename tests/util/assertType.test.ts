import { describe, expect, it } from "vitest";

import {
  assertArray,
  assertArrayOrObject,
  assertInteger,
  assertObject,
  assertString,
} from "../../lib/util/assertType";
import { BadRequestError } from "../../lib/kerror/errors";

describe("#assertType", () => {
  describe("#assertObject", () => {
    it("returns the object unchanged (same reference)", () => {
      const data = { a: 1 };

      expect(assertObject("attr", data)).toBe(data);
    });

    it("maps null and undefined to null instead of throwing", () => {
      expect(assertObject("attr", null)).toBeNull();
      expect(assertObject("attr", undefined)).toBeNull();
    });

    it("rejects arrays and primitives", () => {
      for (const invalid of [[], [1], "str", 1, true]) {
        expect(() => assertObject("attr", invalid)).toThrow(BadRequestError);
      }

      expect(() => assertObject("myAttr", "str")).toThrow(
        'Attribute myAttr must be of type "object"',
      );
    });
  });

  describe("#assertArrayOrObject", () => {
    it("accepts both objects and arrays, unchanged", () => {
      const obj = { a: 1 };
      const arr = [1];

      expect(assertArrayOrObject("attr", obj)).toBe(obj);
      expect(assertArrayOrObject("attr", arr)).toBe(arr);
    });

    it("maps null and undefined to null", () => {
      expect(assertArrayOrObject("attr", null)).toBeNull();
      expect(assertArrayOrObject("attr", undefined)).toBeNull();
    });

    it("rejects primitives", () => {
      expect(() => assertArrayOrObject("myAttr", "str")).toThrow(
        'Attribute myAttr must be of type "object" or "array"',
      );
      expect(() => assertArrayOrObject("attr", 1)).toThrow(BadRequestError);
    });
  });

  describe("#assertArray", () => {
    it("returns a CLONE, not the input array", () => {
      const data = ["a", "b"];
      const result = assertArray("attr", data, "string");

      expect(result).toEqual(["a", "b"]);
      expect(result).not.toBe(data);
    });

    it("maps null and undefined to an empty array", () => {
      expect(assertArray("attr", null, "string")).toEqual([]);
      expect(assertArray("attr", undefined, "string")).toEqual([]);
    });

    it("drops null and undefined entries instead of rejecting them", () => {
      expect(
        assertArray("attr", ["a", null, undefined, "b"], "string"),
      ).toEqual(["a", "b"]);
    });

    it("rejects a non-array", () => {
      expect(() => assertArray("myAttr", "str", "string")).toThrow(
        'Attribute myAttr must be of type "array"',
      );
    });

    it("rejects an entry whose typeof does not match", () => {
      expect(() => assertArray("myAttr", ["a", 1], "string")).toThrow(
        'Attribute myAttr must contain only values of type "string"',
      );
    });

    it("compares against typeof, so 'object' accepts arrays and null-free objects", () => {
      expect(assertArray("attr", [{ a: 1 }, [2]], "object")).toEqual([
        { a: 1 },
        [2],
      ]);
    });
  });

  describe("#assertString", () => {
    it("returns the string unchanged, including the empty string", () => {
      expect(assertString("attr", "value")).toBe("value");
      expect(assertString("attr", "")).toBe("");
    });

    it("maps null and undefined to null", () => {
      expect(assertString("attr", null)).toBeNull();
      expect(assertString("attr", undefined)).toBeNull();
    });

    it("rejects a non-string", () => {
      expect(() => assertString("myAttr", 1)).toThrow(
        'Attribute myAttr must be of type "string"',
      );
      expect(() => assertString("attr", {})).toThrow(BadRequestError);
    });
  });

  describe("#assertInteger", () => {
    it("returns the integer unchanged", () => {
      expect(assertInteger("attr", 0)).toBe(0);
      expect(assertInteger("attr", -42)).toBe(-42);
    });

    // Unlike its siblings, this one has no null/undefined escape hatch.
    it("rejects null and undefined", () => {
      expect(() => assertInteger("attr", null)).toThrow(BadRequestError);
      expect(() => assertInteger("attr", undefined)).toThrow(BadRequestError);
    });

    it("rejects floats, numeric strings, NaN and Infinity", () => {
      for (const invalid of [1.5, "1", NaN, Infinity]) {
        expect(() => assertInteger("myAttr", invalid)).toThrow(
          "Attribute myAttr must be an integer",
        );
      }
    });
  });
});
