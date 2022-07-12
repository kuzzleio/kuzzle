"use strict";

const should = require("should"),
  sinon = require("sinon"),
  rewire = require("rewire");

describe("Test: Deprecate util", () => {
  let item, list, didYouMean, didYouMeanLibraryStub, processStub;

  beforeEach(() => {
    processStub = Object.assign(process, {
      env: Object.assign(process.env, {
        NODE_ENV: "development",
      }),
    });

    didYouMeanLibraryStub = sinon.stub();

    didYouMean = rewire("../../lib/util/didYouMean");

    didYouMean.__set__("process", processStub);
    didYouMean.__set__("didYouMean", didYouMeanLibraryStub);

    item = "item";
    list = ["foo", "bar"];
  });

  describe("#didYouMean", () => {
    it("should call didYouMean library with provided args", () => {
      didYouMean(item, list, "key");

      should(didYouMeanLibraryStub)
        .be.calledOnce()
        .be.calledWith(item, list, "key");
    });

    it("should empty string in production environment", () => {
      processStub.env.NODE_ENV = "production";

      should(didYouMean(item, list)).be.eql("");
    });

    it("should empty string when there is no match", () => {
      didYouMeanLibraryStub.returns(null);

      should(didYouMean(item, list)).be.eql("");
    });

    it("should return a string with the item returned by the library", () => {
      didYouMeanLibraryStub.returns("foo");

      should(didYouMean(item, list)).be.eql(' Did you mean "foo"?');
    });
  });
});
