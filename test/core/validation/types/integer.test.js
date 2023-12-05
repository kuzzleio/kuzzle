"use strict";

const NumericType = require("../../../../lib/core/validation/types/numeric"),
  IntegerType = require("../../../../lib/core/validation/types/integer"),
  should = require("should");

describe("Test: validation/types/integer", () => {
  const integerType = new IntegerType();

  it("should inherit the NumericType class", () => {
    should(integerType).be.instanceOf(NumericType);
  });

  it("should construct properly", () => {
    should(typeof integerType.typeName).be.eql("string");
    should(typeof integerType.allowChildren).be.eql("boolean");
    should(Array.isArray(integerType.allowedTypeOptions)).be.true();
    should(integerType.typeName).be.eql("integer");
    should(integerType.allowChildren).be.false();
  });

  describe("#validate", () => {
    const emptyTypeOptions = {},
      rangeTypeOptions = {
        range: {
          min: 41,
          max: 42,
        },
      };

    it("should return true if fieldValue is valid", () => {
      should(integerType.validate(emptyTypeOptions, 25, [])).be.true();
    });

    it("should return true if fieldValue is valid and in range", () => {
      should(integerType.validate(rangeTypeOptions, 42, [])).be.true();
    });

    it("should return false if fieldValue is not a number", () => {
      const errorMessages = [];

      should(
        integerType.validate(emptyTypeOptions, "a string", errorMessages),
      ).be.false();
      should(errorMessages).be.deepEqual(["The field must be a number."]);
    });

    it("should return false if fieldValue is not an integer", () => {
      const errorMessages = [];

      should(
        integerType.validate(emptyTypeOptions, 42.42, errorMessages),
      ).be.false();
      should(errorMessages).be.deepEqual(["The field must be an integer."]);
    });

    it("should return false if fieldValue is below min", () => {
      const errorMessages = [];

      should(
        integerType.validate(rangeTypeOptions, 40, errorMessages),
      ).be.false();
      should(errorMessages).be.deepEqual([
        "Value 40 is lesser than the allowed minimum (41)",
      ]);
    });

    it("should return false if fieldValue is above max", () => {
      const errorMessages = [];

      should(
        integerType.validate(rangeTypeOptions, 43, errorMessages),
      ).be.false();
      should(errorMessages).be.deepEqual([
        "Value 43 is greater than the allowed maximum (42)",
      ]);
    });
  });
});
