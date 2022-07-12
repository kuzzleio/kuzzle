"use strict";

const PassportResponse = require("../../../lib/core/auth/passportResponse"),
  sinon = require("sinon"),
  should = require("should");

describe("passportResponse tests", () => {
  var passportResponse;

  before(() => {
    passportResponse = new PassportResponse();
  });

  it("should set the header correctly", () => {
    passportResponse.setHeader("field", "myValue");
    return should(passportResponse.getHeader("field")).be.equal("myValue");
  });

  it("should call onEndListener if added", () => {
    var endListener = sinon.stub();

    passportResponse.addEndListener(endListener);
    passportResponse.end(42);
    return should(endListener.called).be.equal(true);
  });
});
