"use strict";

const should = require("should");

const { KuzzleError } = require("../../../lib/kerror/errors");

describe("#ExternalServiceError", () => {
  it("should create a well-formed object", () => {
    const err = new KuzzleError("foobar", 500);

    should(err.message).be.eql("foobar");
    should(err.status).be.eql(500);
    should(err.name).be.eql("KuzzleError");
    should(err.stack).be.a.String();
  });

  it("should derivate from a previous error", () => {
    const orig = new Error("foo"),
      err = new KuzzleError(orig, 500);

    should(err.message).be.eql(orig.message);
    should(err.status).be.eql(500);
    should(err.name).be.eql("KuzzleError");
    should(err.stack).be.eql(orig.stack);
  });

  it("should serialize correctly", () => {
    const err = new KuzzleError("foobar", 500, "ohnoes", 123),
      serialized = JSON.parse(JSON.stringify(err));

    should(serialized.message).be.eql("foobar");
    should(serialized.status).be.eql(500);
    should(serialized.code).be.eql(123);
    should(serialized.id).be.eql("ohnoes");
  });
});
