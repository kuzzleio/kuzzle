"use strict";

const should = require("should"),
  sinon = require("sinon"),
  rewire = require("rewire");

describe("Test: didYouMean util", () => {
  let item, list, didYouMean, didYouMeanLibraryStub, processStub, nodeEnv;

  beforeEach(() => {
    // The subject reads `global.NODE_ENV`, not `process.env.NODE_ENV`, and
    // this spec only ever set the latter: it was passing because
    // `deprecate.test.js` ran earlier in the same Mocha process and left the
    // GLOBAL set to "development". Porting that file to vitest (step 13 L1b4)
    // removed the accidental setup and two tests here started failing. The
    // spec now states its own precondition.
    nodeEnv = global.NODE_ENV;
    global.NODE_ENV = "development";

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

  afterEach(() => {
    global.NODE_ENV = nodeEnv;
  });

  describe("#didYouMean", () => {
    // The library also takes a `key` to compare on when the list holds
    // objects. Every Kuzzle call site passes a list of strings, so the
    // declaration in lib/types/didyoumean.d.ts does not offer one and neither
    // does this wrapper.
    it("should call didYouMean library with provided args", () => {
      didYouMean(item, list);

      should(didYouMeanLibraryStub).be.calledOnce().be.calledWith(item, list);
    });

    it("should empty string in production environment", () => {
      global.NODE_ENV = "production";

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
