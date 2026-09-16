"use strict";

const should = require("should");
const waterfall = require("../../../lib/kuzzle/event/waterfall");

describe("waterfall", () => {
  it("should chain callback and pass the result", (done) => {
    const chain = [(data, cb) => cb(null, data), (data, cb) => cb(null, data)];
    const context = { done };

    waterfall(
      chain,
      [{ data: "foobar" }],
      function (error, result) {
        should(error).be.null();
        should(result).be.eql({ data: "foobar" });

        this.done();
      },
      context,
    );
  });

  it("should chain callback with many arguments", (done) => {
    const chain = [
      (...args) => {
        const cb = args.pop();
        cb(null, ...args);
      },
      (...args) => {
        const cb = args.pop();
        cb(null, ...args);
      },
    ];
    const context = { done };

    waterfall(
      chain,
      [21, 42, 84],
      function (error, ...result) {
        should(error).be.null();
        should(result).be.eql([21, 42, 84]);

        this.done();
      },
      context,
    );
  });

  it("should reject, not resolve, on a chain step that is not callable", (done) => {
    // The regression TD-55 (#2758) fixed: answering "is there a next step?"
    // from the value rather than from the chain resolved the waterfall here,
    // silently skipping every remaining step. A pipe chain is where a plugin
    // denies a request, so the one outcome it must not have is a silent
    // success.
    const ran = [];
    const chain = [
      (data, cb) => {
        ran.push("first");
        cb(null, data);
      },
      undefined,
      (data, cb) => {
        ran.push("third");
        cb(null, data);
      },
    ];
    const context = { done };

    waterfall(
      chain,
      [{ data: "foobar" }],
      function (error, result) {
        should(error).be.instanceOf(TypeError);
        should(result).be.undefined();
        should(ran).be.eql(["first"]);

        this.done();
      },
      context,
    );
  });

  it("should propagate error", (done) => {
    const chain = [
      (data, cb) => cb(new Error("error"), data),
      (data, cb) => cb(null, data),
    ];
    const context = { done };

    waterfall(
      chain,
      [{ data: "foobar" }],
      function (error, result) {
        should(error).not.be.null();
        should(result).be.undefined();

        this.done();
      },
      context,
    );
  });
});
