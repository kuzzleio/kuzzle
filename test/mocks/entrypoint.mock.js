"use strict";

const sinon = require("sinon");

// Mock for the core/network/entryPoint class
class EntryPointMock {
  constructor(config = {}) {
    this.config = config;
    this.execute = sinon.stub().yields({});
    this.newConnection = sinon.stub();
    this.removeConnection = sinon.stub();
    this.logAccess = sinon.stub();
  }
}

module.exports = EntryPointMock;
