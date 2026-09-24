import { beforeEach, describe, expect, it } from "vitest";

import BaseType from "../../../lib/core/validation/baseType";

describe("#core/validation/baseType", () => {
  let baseType: BaseType;

  beforeEach(() => {
    baseType = new BaseType();
  });

  it("defines the 4 base functions", () => {
    expect(typeof baseType.validate).toEqual("function");
    expect(typeof baseType.validateFieldSpecification).toEqual("function");
    expect(typeof baseType.checkAllowedProperties).toEqual("function");
    expect(typeof baseType.getStrictness).toEqual("function");
  });

  it("defines function validate to return always true", () => {
    expect(baseType.validate()).toBe(true);
  });

  it("defines function validateFieldSpecification to return the provided options", () => {
    // The base returns its argument unchanged, so the assertion is identity —
    // it needs *an* options object, not a specific one. It used to pass the
    // string "foobar", which `TypeOptions` (a `Record<string, unknown>`) does
    // not admit; nothing said so while `baseType` was inferred as `any`.
    const typeOptions = { foobar: true };

    expect(baseType.validateFieldSpecification(typeOptions)).toBe(typeOptions);
  });

  it("returns a strict parent's strictness", () => {
    expect(baseType.getStrictness({}, true)).toBe(true);
  });

  it("returns a non-strict parent's strictness", () => {
    expect(baseType.getStrictness({}, false)).toBe(false);
  });

  describe("#checkAllowedProperties", () => {
    const genericMock = {
      foo: "bar",
    };

    it("is true with proper arguments", () => {
      expect(baseType.checkAllowedProperties(genericMock, ["foo", "mod"])).toBe(
        true,
      );
    });

    it("is false if the first argument is not an object", () => {
      expect(baseType.checkAllowedProperties("notAnObject", ["foo"])).toBe(
        false,
      );
    });

    it("is false if one of the property is not allowed", () => {
      expect(
        baseType.checkAllowedProperties({ foo: "bar", baz: "bar" }, ["foo"]),
      ).toBe(false);
    });
  });
});
