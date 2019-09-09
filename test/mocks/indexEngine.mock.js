'use strict';

const
  sinon = require('sinon'),
  IndexStorage = require('../../lib/api/core/storage/indexStorage');

class IndexStorageMock extends IndexStorage {
  constructor (...args) {
    super(...args);

    this.init = sinon.stub().resolves();
    this.get = sinon.stub().resolves();
    this.mGet = sinon.stub().resolves();
    this.search = sinon.stub().resolves();
    this.scroll = sinon.stub().resolves();
    this.count = sinon.stub().resolves();
    this.create = sinon.stub().resolves();
    this.createOrReplace = sinon.stub().resolves();
    this.replace = sinon.stub().resolves();
    this.update = sinon.stub().resolves();
    this.delete = sinon.stub().resolves();
    this.exists = sinon.stub().resolves();
    this.createCollection = sinon.stub().resolves();
  }
}

module.exports = IndexStorageMock;