import { describe, expect, it } from "vitest";

import { invalid } from "../../../helpers/invalid";

import BaseType from "../../../../lib/core/validation/baseType";
import NumericType from "../../../../lib/core/validation/types/numeric";
import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";

describe("#core/validation/types/numeric", () => {
  const numericType = new NumericType();

  it("inherits the BaseType class", () => {
    expect(numericType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof numericType.typeName).toEqual("string");
    expect(typeof numericType.allowChildren).toEqual("boolean");
    expect(Array.isArray(numericType.allowedTypeOptions)).toBe(true);
    expect(numericType.typeName).toEqual("numeric");
    expect(numericType.allowChildren).toBe(false);
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
      expect(numericType.validate(emptyTypeOptions, 25.25, [])).toBe(true);
    });

    it("returns true if fieldValue is valid and in range", () => {
      expect(numericType.validate(rangeTypeOptions, 41.5, [])).toBe(true);
    });

    it("returns false if fieldValue is not a number", () => {
      const errorMessages: string[] = [];

      expect(
        numericType.validate(emptyTypeOptions, "a string", errorMessages),
      ).toBe(false);
      expect(errorMessages).toEqual(["The field must be a number."]);
    });

    it("returns false if fieldValue is below min", () => {
      const errorMessages: string[] = [];

      expect(numericType.validate(rangeTypeOptions, 40.99, errorMessages)).toBe(
        false,
      );
      expect(errorMessages).toEqual([
        "Value 40.99 is lesser than the allowed minimum (41)",
      ]);
    });

    it("returns false if fieldValue is above max", () => {
      const errorMessages: string[] = [];

      expect(numericType.validate(rangeTypeOptions, 42.1, errorMessages)).toBe(
        false,
      );
      expect(errorMessages).toEqual([
        "Value 42.1 is greater than the allowed maximum (42)",
      ]);
    });
  });

  describe("#validateFieldSpecification", () => {
    it("returns the options untouched when no range is given", () => {
      // The `has(typeOptions, "range")` guard's false arm: no other test in
      // this file reaches it, and the Mocha spec only appeared to because the
      // whole suite was measured together.
      const opts = {};

      expect(numericType.validateFieldSpecification(opts)).toEqual(opts);
    });

    it("validates if set properly", () => {
      const opts = {
        range: {
          min: 41,
          max: 42,
        },
      };

      expect(numericType.validateFieldSpecification(opts)).toEqual(opts);
    });

    it('should throw if "range" is not an object', () => {
      [[], undefined, null, "foobar", 123].forEach((range) => {
        expect(() =>
          numericType.validateFieldSpecification(invalid({ range })),
        ).toThrow(PreconditionError);
        expect(() =>
          numericType.validateFieldSpecification(invalid({ range })),
        ).toThrow(
          expect.objectContaining({
            id: "validation.assert.unexpected_properties",
          }),
        );
      });
    });

    it("throws if an unrecognized property is passed to the range options", () => {
      expect(() =>
        numericType.validateFieldSpecification(
          invalid({ range: { foo: 123 } }),
        ),
      ).toThrow(PreconditionError);
      expect(() =>
        numericType.validateFieldSpecification(
          invalid({ range: { foo: 123 } }),
        ),
      ).toThrow(
        expect.objectContaining({
          id: "validation.assert.unexpected_properties",
        }),
      );
    });

    it("throws if a non-numeric value is passed to the min or max properties", () => {
      [[], {}, undefined, null, "foo"].forEach((v) => {
        expect(() =>
          numericType.validateFieldSpecification(
            invalid({ range: { min: v } }),
          ),
        ).toThrow(PreconditionError);
        expect(() =>
          numericType.validateFieldSpecification(
            invalid({ range: { min: v } }),
          ),
        ).toThrow(
          expect.objectContaining({ id: "validation.assert.invalid_type" }),
        );

        expect(() =>
          numericType.validateFieldSpecification(
            invalid({ range: { max: v } }),
          ),
        ).toThrow(PreconditionError);
        expect(() =>
          numericType.validateFieldSpecification(
            invalid({ range: { max: v } }),
          ),
        ).toThrow(
          expect.objectContaining({ id: "validation.assert.invalid_type" }),
        );
      });
    });

    it("throws if min is greater than max", () => {
      expect(() =>
        numericType.validateFieldSpecification({
          range: {
            min: 42,
            max: 41,
          },
        }),
      ).toThrow(PreconditionError);
      expect(() =>
        numericType.validateFieldSpecification({
          range: {
            min: 42,
            max: 41,
          },
        }),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_range" }),
      );
    });
  });
});
