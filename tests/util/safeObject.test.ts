import { describe, expect, it } from "vitest";

import { get, has, isPlainObject } from "../../lib/util/safeObject";

describe("#safeObject", () => {
  describe("#has", () => {
    it("reports own properties only", () => {
      expect(has({ a: 1 }, "a")).toBe(true);
      expect(has({ a: undefined }, "a")).toBe(true);
      expect(has({}, "a")).toBe(false);
      // Inherited properties are not own properties — that is the whole point
      // of using this over the `in` operator.
      expect(has({}, "toString")).toBe(false);
      expect(has(Object.create({ a: 1 }), "a")).toBe(false);
    });

    it("accepts symbol and numeric keys", () => {
      const sym = Symbol("s");

      expect(has({ [sym]: 1 }, sym)).toBe(true);
      expect(has({ 1: "one" }, 1)).toBe(true);
      expect(has(["first"], 0)).toBe(true);
      expect(has(["first"], 1)).toBe(false);
    });

    it("returns false for a primitive without that property", () => {
      expect(has(1, "a")).toBe(false);
      expect(has("ab", 0)).toBe(true);
    });

    // Worth pinning: despite the module name, this is NOT null-safe. Callers
    // guard with `request.input.headers && has(request.input.headers, …)`
    // precisely because of this (see funnel._isOriginAuthorized).
    it("throws on null or undefined rather than returning false", () => {
      expect(() => has(null, "a")).toThrow(TypeError);
      expect(() => has(undefined, "a")).toThrow(TypeError);
    });
  });

  describe("#get", () => {
    it("returns the value of an own property", () => {
      expect(get({ a: 1 }, "a")).toBe(1);
      expect(get({ a: null }, "a")).toBeNull();
    });

    it("returns undefined for a missing or inherited property", () => {
      expect(get({}, "a")).toBeUndefined();
      expect(get({}, "toString")).toBeUndefined();
      expect(get(Object.create({ a: 1 }), "a")).toBeUndefined();
    });

    it("distinguishes an absent property from one set to undefined only through has()", () => {
      expect(get({ a: undefined }, "a")).toBeUndefined();
      expect(has({ a: undefined }, "a")).toBe(true);
      expect(has({}, "a")).toBe(false);
    });
  });

  describe("#isPlainObject", () => {
    it("accepts object literals and null-prototype objects", () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
      expect(isPlainObject(Object.create(null))).toBe(true);
    });

    it("rejects everything else", () => {
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
      expect(isPlainObject("str")).toBe(false);
      expect(isPlainObject(1)).toBe(false);
      expect(isPlainObject(new Date())).toBe(false);
      expect(isPlainObject(/re/)).toBe(false);
      expect(isPlainObject(() => undefined)).toBe(false);
      expect(isPlainObject(new Map())).toBe(false);
    });

    it("accepts a class instance — it only checks the toString tag", () => {
      class Foo {}

      expect(isPlainObject(new Foo())).toBe(true);
    });
  });
});
