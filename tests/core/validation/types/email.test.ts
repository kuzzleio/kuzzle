import { describe, expect, it } from "vitest";

import { invalid } from "../../../helpers/invalid";

import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";
import BaseType from "../../../../lib/core/validation/baseType";
import EmailType from "../../../../lib/core/validation/types/email";

describe("#core/validation/types/email", () => {
  const emailType = new EmailType();

  it("derivates from BaseType", () => {
    expect(emailType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof emailType.typeName).toEqual("string");
    expect(typeof emailType.allowChildren).toEqual("boolean");
    expect(Array.isArray(emailType.allowedTypeOptions)).toBe(true);
    expect(emailType.typeName).toEqual("email");
    expect(emailType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    it("returns true if the provided email is valid", () => {
      expect(
        emailType.validate({ notEmpty: true }, "user@domain.com", []),
      ).toBe(true);
    });

    it("returns true if email is optional and no email is provided", () => {
      expect(emailType.validate({ notEmpty: false }, "", [])).toBe(true);
      expect(emailType.validate({ notEmpty: false }, undefined, [])).toBe(true);
      expect(emailType.validate({ notEmpty: false }, null, [])).toBe(true);
    });

    it("returns false if no email is provided and if an email is required", () => {
      const errorMessage = [];

      expect(emailType.validate({ notEmpty: true }, "", errorMessage)).toBe(
        false,
      );
      expect(errorMessage).toEqual(["The string must not be empty."]);

      errorMessage.shift();
      expect(
        emailType.validate({ notEmpty: true }, undefined, errorMessage),
      ).toBe(false);
      expect(errorMessage).toEqual(["Field cannot be undefined or null"]);

      errorMessage.shift();
      expect(emailType.validate({ notEmpty: true }, null, errorMessage)).toBe(
        false,
      );
      expect(errorMessage).toEqual(["Field cannot be undefined or null"]);
    });

    it("returns false if the value is not valid", () => {
      const errorMessage = [];

      expect(
        emailType.validate({ notEmpty: true }, "not an email", errorMessage),
      ).toBe(false);
      expect(errorMessage).toEqual([
        "The string must be a valid email address.",
      ]);
    });

    it("returns false if the value is not valid", () => {
      const errorMessage = [];

      expect(
        emailType.validate(
          { notEmpty: true },
          { not: "a string" },
          errorMessage,
        ),
      ).toBe(false);
      expect(errorMessage).toEqual(["The field must be a string."]);
    });
  });

  describe("#validateFieldSpecification", () => {
    it("returns defaulted typeOptions if properties are missing", () => {
      expect(emailType.validateFieldSpecification({})).toEqual({
        notEmpty: false,
      });
    });

    it("returns the same typeOptions if it is valid", () => {
      expect(
        emailType.validateFieldSpecification({
          notEmpty: true,
        }),
      ).toEqual({
        notEmpty: true,
      });
    });

    it('should throw if the provided "notEmpty" option is invalid', () => {
      expect(() =>
        emailType.validateFieldSpecification(invalid({ notEmpty: "foobar" })),
      ).toThrow(PreconditionError);
      expect(() =>
        emailType.validateFieldSpecification(invalid({ notEmpty: "foobar" })),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });
  });
});
