"use strict";

const sinon = require("sinon");

function mockAssertion(object) {
  object.assertBodyHasNotAttributes = sinon.stub();
  object.assertIsStrategyRegistered = sinon.stub();
  object.assertIndexExists = sinon.stub();
  object.assertIndexAndCollectionExists = sinon.stub();
  object.assertNotExceedMaxFetch = sinon.stub();
  object.assertIsAuthenticated = sinon.stub();

  return object;
}

module.exports = mockAssertion;
