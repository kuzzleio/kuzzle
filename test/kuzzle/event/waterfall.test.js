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
      context
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
      context
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
      context
    );
  });
});
