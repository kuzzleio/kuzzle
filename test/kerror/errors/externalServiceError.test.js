"use strict";

const should = require("should");

const { ExternalServiceError } = require("../../../lib/kerror/errors");

describe("#ExternalServiceError", () => {
  it("should create a well-formed object", () => {
    let err = new ExternalServiceError("foobar");

    should(err.message).be.eql("foobar");
    should(err.status).be.eql(500);
    should(err.name).be.eql("ExternalServiceError");
  });

  it("should serialize correctly", () => {
    let err = JSON.parse(JSON.stringify(new ExternalServiceError("foobar")));

    should(err.message).be.eql("foobar");
    should(err.status).be.eql(500);
  });
});
