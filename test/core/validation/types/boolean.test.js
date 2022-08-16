"use strict";

const BaseType = require("../../../../lib/core/validation/baseType"),
  BooleanType = require("../../../../lib/core/validation/types/boolean"),
  should = require("should");

describe("Test: validation/types/boolean", () => {
  const booleanType = new BooleanType();

  it("should inherit the BaseType class", () => {
    should(booleanType).be.instanceOf(BaseType);
  });

  it("should construct properly", () => {
    should(typeof booleanType.typeName).be.eql("string");
    should(typeof booleanType.allowChildren).be.eql("boolean");
    should(Array.isArray(booleanType.allowedTypeOptions)).be.true();
    should(booleanType.typeName).be.eql("boolean");
    should(booleanType.allowChildren).be.false();
  });

  describe("#validate", () => {
    it("should return true if fieldValue is a boolean", () => {
      const errorMessages = [];

      should(booleanType.validate({}, true, errorMessages)).be.true();
      should(errorMessages).be.an.Array().and.be.empty();

      should(booleanType.validate({}, false, errorMessages)).be.true();
      should(errorMessages).be.an.Array().and.be.empty();
    });

    it("should return false if fieldValue is not a boolean", () => {
      const errorMessages = [];

      should(booleanType.validate({}, "foo", errorMessages)).be.false();
      should(errorMessages).be.deepEqual([
        "The field must be of type boolean.",
      ]);
    });
  });
});
