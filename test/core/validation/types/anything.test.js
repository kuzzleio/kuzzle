"use strict";

const BaseType = require("../../../../lib/core/validation/baseType"),
  AnythingType = require("../../../../lib/core/validation/types/anything"),
  should = require("should");

describe("Test: validation/types/anything", () => {
  const anythingType = new AnythingType();

  it("should inherit the BaseType class", () => {
    should(anythingType).be.instanceOf(BaseType);
  });

  it("should construct properly", () => {
    should(typeof anythingType.typeName).be.eql("string");
    should(typeof anythingType.allowChildren).be.eql("boolean");
    should(Array.isArray(anythingType.allowedTypeOptions)).be.true();
    should(anythingType.typeName).be.eql("anything");
    should(anythingType.allowChildren).be.false();
  });

  describe("#validate", () => {
    it("should always return true", () => {
      should(anythingType.validate()).be.true();
    });
  });

  describe("#validateFieldSpecification", () => {
    it("should always return the provided options", () => {
      should(anythingType.validateFieldSpecification("foobar")).be.equal(
        "foobar"
      );
    });
  });
});
