import { describe, expect, it } from "vitest";

import { invalid } from "../../../helpers/invalid";

import BaseType from "../../../../lib/core/validation/baseType";
import StringType from "../../../../lib/core/validation/types/string";
import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";

describe("#core/validation/types/string", () => {
  const stringType = new StringType();

  it("inherits the BaseType class", () => {
    expect(stringType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof stringType.typeName).toEqual("string");
    expect(typeof stringType.allowChildren).toEqual("boolean");
    expect(Array.isArray(stringType.allowedTypeOptions)).toBe(true);
    expect(stringType.typeName).toEqual("string");
    expect(stringType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    it("returns true if the value is valid", () => {
      expect(stringType.validate({}, "a string", [])).toBe(true);
    });

    it("returns true if the string length is comprised in the provided length range", () => {
      expect(
        stringType.validate({ length: { min: 7, max: 9 } }, "a string", []),
      ).toBe(true);
    });

    it("returns false if the value is not a string", () => {
      [[], {}, 123, null, undefined].forEach((v) => {
        const errorMessage: string[] = [];

        expect(stringType.validate({}, v, errorMessage)).toBe(false);
        expect(errorMessage).toEqual(["The field must be a string."]);
      });
    });

    it("returns false if the value length is below the expected minimum", () => {
      const errorMessage: string[] = [];

      expect(
        stringType.validate({ length: { min: 10 } }, "a string", errorMessage),
      ).toBe(false);
      expect(errorMessage).toEqual([
        'Invalid string length. Expected min: 10. Received: 8 ("a string")',
      ]);
    });

    it("returns false if the value length is above the expected maximum", () => {
      const errorMessage: string[] = [];

      expect(
        stringType.validate({ length: { max: 5 } }, "a string", errorMessage),
      ).toBe(false);
      expect(errorMessage).toEqual([
        'Invalid string length. Expected max: 5. Received: 8 ("a string")',
      ]);
    });
  });

  describe("#validateFieldSpecification", () => {
    it("returns the options untouched when no length is given", () => {
      // The `has(typeOptions, "length")` guard's false arm — see the same
      // case in numeric.test.ts.
      const opts = {};

      expect(stringType.validateFieldSpecification(opts)).toEqual(opts);
    });

    it("validates the typeOptions object is set properly", () => {
      const opts = {
        length: {
          min: 41,
          max: 42,
        },
      };

      expect(stringType.validateFieldSpecification(opts)).toEqual(opts);
    });

    it('should throw if "length" is not an object', () => {
      [[], undefined, null, "foobar", 123].forEach((length) => {
        expect(() =>
          stringType.validateFieldSpecification(invalid({ length })),
        ).toThrow(PreconditionError);
        expect(() =>
          stringType.validateFieldSpecification(invalid({ length })),
        ).toThrow(
          expect.objectContaining({
            id: "validation.assert.unexpected_properties",
          }),
        );
      });
    });

    it("throws if an unrecognized property is passed to the length options", () => {
      expect(() =>
        stringType.validateFieldSpecification(
          invalid({ length: { foo: 123 } }),
        ),
      ).toThrow(PreconditionError);
      expect(() =>
        stringType.validateFieldSpecification(
          invalid({ length: { foo: 123 } }),
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
          stringType.validateFieldSpecification(
            invalid({ length: { min: v } }),
          ),
        ).toThrow(PreconditionError);
        expect(() =>
          stringType.validateFieldSpecification(
            invalid({ length: { min: v } }),
          ),
        ).toThrow(
          expect.objectContaining({ id: "validation.assert.invalid_type" }),
        );

        expect(() =>
          stringType.validateFieldSpecification(
            invalid({ length: { max: v } }),
          ),
        ).toThrow(PreconditionError);
        expect(() =>
          stringType.validateFieldSpecification(
            invalid({ length: { max: v } }),
          ),
        ).toThrow(
          expect.objectContaining({ id: "validation.assert.invalid_type" }),
        );
      });
    });

    it("throws if min is greater than max", () => {
      expect(() =>
        stringType.validateFieldSpecification({
          length: {
            min: 42,
            max: 41,
          },
        }),
      ).toThrow(PreconditionError);
      expect(() =>
        stringType.validateFieldSpecification({
          length: {
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
