import { describe, expect, it } from "vitest";

import BaseType from "../../../../lib/core/validation/baseType";
import BooleanType from "../../../../lib/core/validation/types/boolean";

describe("#core/validation/types/boolean", () => {
  const booleanType = new BooleanType();

  it("inherits the BaseType class", () => {
    expect(booleanType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof booleanType.typeName).toEqual("string");
    expect(typeof booleanType.allowChildren).toEqual("boolean");
    expect(Array.isArray(booleanType.allowedTypeOptions)).toBe(true);
    expect(booleanType.typeName).toEqual("boolean");
    expect(booleanType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    it("returns true if fieldValue is a boolean", () => {
      const errorMessages: string[] = [];

      expect(booleanType.validate({}, true, errorMessages)).toBe(true);
      expect(Array.isArray(errorMessages)).toBe(true);
      expect(errorMessages).toHaveLength(0);

      expect(booleanType.validate({}, false, errorMessages)).toBe(true);
      expect(Array.isArray(errorMessages)).toBe(true);
      expect(errorMessages).toHaveLength(0);
    });

    it("returns false if fieldValue is not a boolean", () => {
      const errorMessages: string[] = [];

      expect(booleanType.validate({}, "foo", errorMessages)).toBe(false);
      expect(errorMessages).toEqual(["The field must be of type boolean."]);
    });
  });
});
