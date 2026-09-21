import { describe, expect, it } from "vitest";

import { invalid } from "../../../helpers/invalid";

import BaseType from "../../../../lib/core/validation/baseType";
import ObjectType from "../../../../lib/core/validation/types/object";
import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";

describe("#core/validation/types/object", () => {
  const objectType = new ObjectType();

  it("inherits the BaseType class", () => {
    expect(objectType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof objectType.typeName).toEqual("string");
    expect(typeof objectType.allowChildren).toEqual("boolean");
    expect(Array.isArray(objectType.allowedTypeOptions)).toBe(true);
    expect(objectType.typeName).toEqual("object");
    expect(objectType.allowChildren).toBe(true);
  });

  describe("#validate", () => {
    it("returns true if the value is an object", () => {
      expect(objectType.validate({}, {}, [])).toBe(true);
    });

    it("returns false if the value is not an object", () => {
      [[], "foobar", undefined, null, 123].forEach((v) => {
        const errorMessages = [];

        expect(objectType.validate({}, v, errorMessages)).toBe(false);
        expect(errorMessages).toEqual(["The value must be an object."]);
      });
    });
  });

  describe("#validateFieldSpecification", () => {
    it("throws if the strict option is not a boolean", () => {
      expect(() =>
        objectType.validateFieldSpecification(
          invalid({ strict: "not a boolean" }),
        ),
      ).toThrow(PreconditionError);
      expect(() =>
        objectType.validateFieldSpecification(
          invalid({ strict: "not a boolean" }),
        ),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });

    it("returns the typeOptions object if it is valid", () => {
      const opts = { strict: false };

      expect(objectType.validateFieldSpecification(opts)).toEqual(opts);
    });
  });

  describe("#getStrictness", () => {
    it("returns parentStrictness if strict is not defined in typeOptions", () => {
      expect(objectType.getStrictness({}, true)).toBe(true);
    });

    it("returns parentStrictness if strict is not defined in typeOptions", () => {
      expect(objectType.getStrictness({}, false)).toBe(false);
    });

    it("returns strict option if defined", () => {
      expect(objectType.getStrictness({ strict: true }, false)).toBe(true);
    });
  });
});
