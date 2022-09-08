"use strict";

const { StorageEngine } = require("../../lib/core/storage/storageEngine");
const sinon = require("sinon");

class StorageEngineMock extends StorageEngine {
  constructor() {
    super();
    sinon.stub(this, "init").resolves();
  }
}

module.exports = StorageEngineMock;
