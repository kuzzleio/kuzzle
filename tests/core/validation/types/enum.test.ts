import { describe, expect, it } from "vitest";

import { invalid } from "../../../helpers/invalid";

import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";
import BaseType from "../../../../lib/core/validation/baseType";
import EnumType from "../../../../lib/core/validation/types/enum";

describe("#core/validation/types/enum", () => {
  const enumType = new EnumType();

  it("inherits the BaseType class", () => {
    expect(enumType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof enumType.typeName).toEqual("string");
    expect(typeof enumType.allowChildren).toEqual("boolean");
    expect(Array.isArray(enumType.allowedTypeOptions)).toBe(true);
    expect(enumType.typeName).toEqual("enum");
    expect(enumType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    const typeOptions = {
      values: ["a string", "another string", "one more string"],
    };

    it("rejects every value when none is declared", () => {
      // `typeOptions.values ?? []` — the nullish fallback. Only a field
      // specification declaring no values at all reaches it, which
      // `validateFieldSpecification` refuses but `validate` still has to
      // survive.
      const errorMessages: string[] = [];

      expect(enumType.validate({}, "a string", errorMessages)).toBe(false);
      expect(errorMessages).toEqual([
        'The field only accepts following values: "".',
      ]);
    });

    it("returns true if fieldValue is a listed value", () => {
      expect(enumType.validate(typeOptions, "another string", [])).toBe(true);
    });

    it("returns false if the value is not listed by the enumeration", () => {
      const errorMessage: string[] = [];

      expect(
        enumType.validate(
          typeOptions,
          "not the string you are looking for",
          errorMessage,
        ),
      ).toBe(false);
      expect(errorMessage).toEqual([
        `The field only accepts following values: "${typeOptions.values.join(
          ", ",
        )}".`,
      ]);
    });

    it("returns false if the value is not a string", () => {
      const errorMessage: string[] = [];

      expect(
        enumType.validate(typeOptions, { not: "a string" }, errorMessage),
      ).toBe(false);
      expect(errorMessage).toEqual(["The field must be a string."]);
    });
  });

  describe("#validateFieldSpecification", () => {
    it("throws if no values are provided", () => {
      expect(() => enumType.validateFieldSpecification({})).toThrow(
        PreconditionError,
      );
      expect(() => enumType.validateFieldSpecification({})).toThrow(
        expect.objectContaining({ id: "validation.types.missing_enum_values" }),
      );

      expect(() => enumType.validateFieldSpecification({ values: [] })).toThrow(
        PreconditionError,
      );
      expect(() => enumType.validateFieldSpecification({ values: [] })).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );

      expect(() =>
        enumType.validateFieldSpecification(invalid({ values: "foobar" })),
      ).toThrow(PreconditionError);
      expect(() =>
        enumType.validateFieldSpecification(invalid({ values: "foobar" })),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("throws if a listed value is not a string", () => {
      expect(() =>
        enumType.validateFieldSpecification(
          invalid({ values: [true, 42, "a string"] }),
        ),
      ).toThrow(PreconditionError);
      expect(() =>
        enumType.validateFieldSpecification(
          invalid({ values: [true, 42, "a string"] }),
        ),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );

      expect(() =>
        enumType.validateFieldSpecification({ values: ["a string", null] }),
      ).toThrow(PreconditionError);
      expect(() =>
        enumType.validateFieldSpecification({ values: ["a string", null] }),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("returns the options intact if it is valid", () => {
      expect(
        enumType.validateFieldSpecification({
          values: ["a string", "another string", "one more string"],
        }),
      ).toEqual({
        values: ["a string", "another string", "one more string"],
      });
    });
  });
});
