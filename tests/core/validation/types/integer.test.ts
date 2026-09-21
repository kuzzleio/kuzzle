import { describe, expect, it } from "vitest";

import NumericType from "../../../../lib/core/validation/types/numeric";
import IntegerType from "../../../../lib/core/validation/types/integer";

describe("#core/validation/types/integer", () => {
  const integerType = new IntegerType();

  it("inherits the NumericType class", () => {
    expect(integerType).toBeInstanceOf(NumericType);
  });

  it("constructs properly", () => {
    expect(typeof integerType.typeName).toEqual("string");
    expect(typeof integerType.allowChildren).toEqual("boolean");
    expect(Array.isArray(integerType.allowedTypeOptions)).toBe(true);
    expect(integerType.typeName).toEqual("integer");
    expect(integerType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    const emptyTypeOptions = {},
      rangeTypeOptions = {
        range: {
          min: 41,
          max: 42,
        },
      };

    it("returns true if fieldValue is valid", () => {
      expect(integerType.validate(emptyTypeOptions, 25, [])).toBe(true);
    });

    it("returns true if fieldValue is valid and in range", () => {
      expect(integerType.validate(rangeTypeOptions, 42, [])).toBe(true);
    });

    it("returns false if fieldValue is not a number", () => {
      const errorMessages = [];

      expect(
        integerType.validate(emptyTypeOptions, "a string", errorMessages),
      ).toBe(false);
      expect(errorMessages).toEqual(["The field must be a number."]);
    });

    it("returns false if fieldValue is not an integer", () => {
      const errorMessages = [];

      expect(integerType.validate(emptyTypeOptions, 42.42, errorMessages)).toBe(
        false,
      );
      expect(errorMessages).toEqual(["The field must be an integer."]);
    });

    it("returns false if fieldValue is below min", () => {
      const errorMessages = [];

      expect(integerType.validate(rangeTypeOptions, 40, errorMessages)).toBe(
        false,
      );
      expect(errorMessages).toEqual([
        "Value 40 is lesser than the allowed minimum (41)",
      ]);
    });

    it("returns false if fieldValue is above max", () => {
      const errorMessages = [];

      expect(integerType.validate(rangeTypeOptions, 43, errorMessages)).toBe(
        false,
      );
      expect(errorMessages).toEqual([
        "Value 43 is greater than the allowed maximum (42)",
      ]);
    });
  });
});
