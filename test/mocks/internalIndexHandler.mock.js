"use strict";

const sinon = require("sinon");

const InternalIndexHandler = require("../../lib/kuzzle/internalIndexHandler");

class InternalIndexHandlerMock extends InternalIndexHandler {
  constructor() {
    super();

    sinon.stub(this, "init");
    sinon.stub(this, "createInitialSecurities").resolves();
    sinon.stub(this, "createInitialValidations").resolves();
  }
}

module.exports = InternalIndexHandlerMock;
