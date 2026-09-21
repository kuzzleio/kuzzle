import { beforeEach, describe, expect, it } from "vitest";

import BaseType from "../../../lib/core/validation/baseType";

describe("#core/validation/baseType", () => {
  let baseType;

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
    expect(baseType.validateFieldSpecification("foobar")).toBe("foobar");
  });

  it("defines function getStrictness to return parent's strictness", () => {
    expect(baseType.getStrictness({}, true)).toBe(true);
  });

  it("defines function getStrictness to return parent's strictness", () => {
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
