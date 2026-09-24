import { describe, expect, it } from "vitest";

import BaseType from "../../../../lib/core/validation/baseType";
import IpAddressType from "../../../../lib/core/validation/types/ipAddress";
import { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";

describe("#core/validation/types/ipAddress", () => {
  const ipAddressType = new IpAddressType();

  it("inherits the BaseType class", () => {
    expect(ipAddressType).toBeInstanceOf(BaseType);
  });

  it("constructs properly", () => {
    expect(typeof ipAddressType.typeName).toEqual("string");
    expect(typeof ipAddressType.allowChildren).toEqual("boolean");
    expect(Array.isArray(ipAddressType.allowedTypeOptions)).toBe(true);
    expect(ipAddressType.typeName).toEqual("ip_address");
    expect(ipAddressType.allowChildren).toBe(false);
  });

  describe("#validate", () => {
    it("returns true if the value is a valid IPv4 address", () => {
      expect(ipAddressType.validate({ notEmpty: true }, "127.0.0.1", [])).toBe(
        true,
      );
    });

    it("returns true if the value is a valid IPv6 address", () => {
      expect(ipAddressType.validate({ notEmpty: true }, "::1", [])).toBe(true);
      expect(
        ipAddressType.validate({ notEmpty: true }, "2001:db8::1", []),
      ).toBe(true);
    });

    it("returns true if no address is provided and if it is optional", () => {
      expect(ipAddressType.validate({ notEmpty: false }, "", [])).toBe(true);
    });

    it("returns false if no address is provided while being required", () => {
      const errorMessage: string[] = [];

      expect(ipAddressType.validate({ notEmpty: true }, "", errorMessage)).toBe(
        false,
      );
      expect(errorMessage).toEqual(["The string must not be empty."]);
    });

    it("returns false if the value is not a valid IP address", () => {
      ["foobar", "1.2.3.256", "2001:dg8::1"].forEach((ip) => {
        const errorMessage: string[] = [];

        expect(
          ipAddressType.validate({ notEmpty: true }, ip, errorMessage),
        ).toBe(false);
        expect(errorMessage).toEqual([
          "The string must be a valid IP address.",
        ]);
      });
    });

    it("returns false if the value is not a string", () => {
      [[], {}, null, undefined, 123].forEach((v) => {
        const errorMessage: string[] = [];

        expect(
          ipAddressType.validate({ notEmpty: true }, v, errorMessage),
        ).toBe(false);
        expect(errorMessage).toEqual(["The field must be a string."]);
      });
    });
  });

  describe("#validateFieldSpecification", () => {
    it("returns a defaulted typeOptions object if none is provided", () => {
      expect(ipAddressType.validateFieldSpecification({})).toEqual({
        notEmpty: false,
      });
    });

    it("does not change a typeOptions object if a valid one is provided", () => {
      expect(
        ipAddressType.validateFieldSpecification({
          notEmpty: true,
        }),
      ).toEqual({
        notEmpty: true,
      });
    });

    it('should throw if "notEmpty" is not set properly', () => {
      expect(() =>
        ipAddressType.validateFieldSpecification({ notEmpty: null }),
      ).toThrow(PreconditionError);
      expect(() =>
        ipAddressType.validateFieldSpecification({ notEmpty: null }),
      ).toThrow(
        expect.objectContaining({ id: "validation.assert.invalid_type" }),
      );
    });
  });
});
