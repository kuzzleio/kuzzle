import { describe, expect, it } from "vitest";

import { invalid } from "../../../helpers/invalid";

import BaseType from "../../../../lib/core/validation/baseType";
import AnythingType from "../../../../lib/core/validation/types/anything";

describe("#core/validation/types/anything", () => {
  const anythingType = new AnythingType();

  it("inherits the BaseType class", () => {
    expect(anythingType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof anythingType.typeName).toEqual("string");
    expect(typeof anythingType.allowChildren).toEqual("boolean");
    expect(Array.isArray(anythingType.allowedTypeOptions)).toBe(true);
    expect(anythingType.typeName).toEqual("anything");
    expect(anythingType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    it("always returns true", () => {
      expect(anythingType.validate()).toBe(true);
    });
  });

  describe("#validateFieldSpecification", () => {
    it("always returns the provided options", () => {
      expect(anythingType.validateFieldSpecification(invalid("foobar"))).toBe(
        "foobar",
      );
    });
  });
});
