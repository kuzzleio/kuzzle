import { describe, expect, it } from "vitest";

import { invalid } from "../../../helpers/invalid";

import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";
import BaseType from "../../../../lib/core/validation/baseType";
import UrlType from "../../../../lib/core/validation/types/url";

describe("#core/validation/types/url", () => {
  const urlType = new UrlType();

  it("inherits the BaseType class", () => {
    expect(urlType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof urlType.typeName).toEqual("string");
    expect(typeof urlType.allowChildren).toEqual("boolean");
    expect(Array.isArray(urlType.allowedTypeOptions)).toBe(true);
    expect(urlType.typeName).toEqual("url");
    expect(urlType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    it("returns true if the value is valid", () => {
      expect(
        urlType.validate({ notEmpty: true }, "http://www.domain.com/", []),
      ).toBe(true);
    });

    it("returns true if the value is empty and optional", () => {
      expect(urlType.validate({ notEmpty: false }, "", [])).toBe(true);
    });

    it("returns false if the value is empty and required", () => {
      const errorMessage = [];

      expect(urlType.validate({ notEmpty: true }, "", errorMessage)).toBe(
        false,
      );
      expect(errorMessage).toEqual(["The string must not be empty."]);
    });

    it("returns false if the value is not a valid URL address", () => {
      const errorMessage = [];

      expect(
        urlType.validate(
          { notEmpty: true },
          "not an url address",
          errorMessage,
        ),
      ).toBe(false);
      expect(errorMessage).toEqual(["The string must be a valid URL."]);
    });

    it("returns false if the value is not a string", () => {
      [[], {}, 123, undefined, null, false].forEach((v) => {
        const errorMessage = [];

        expect(urlType.validate({ notEmpty: true }, v, errorMessage)).toBe(
          false,
        );
        expect(errorMessage).toEqual(["The field must be a string."]);
      });
    });
  });

  describe("#validateFieldSpecification", () => {
    it("returns a defaulted typeOptions object if none is provided", () => {
      expect(urlType.validateFieldSpecification({})).toEqual({
        notEmpty: false,
      });
    });

    it("returns the same typeOptions if it is set properly", () => {
      expect(
        urlType.validateFieldSpecification({
          notEmpty: true,
        }),
      ).toEqual({
        notEmpty: true,
      });
    });

    it("throws if notEmpty is not set properly", () => {
      [[], {}, "foo", 123, undefined, null].forEach((v) => {
        expect(() =>
          urlType.validateFieldSpecification(invalid({ notEmpty: v })),
        ).toThrow(PreconditionError);
        expect(() =>
          urlType.validateFieldSpecification(invalid({ notEmpty: v })),
        ).toThrow(
          expect.objectContaining({ id: "validation.assert.invalid_type" }),
        );
      });
    });
  });
});
