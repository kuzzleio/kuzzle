'use strict';

const
  sinon = require('sinon'),
  IndexStorage = require('../../lib/api/core/storage/indexStorage');

class IndexStorageMock extends IndexStorage {
  constructor (...args) {
    super(...args);

    for (const method of this._rawMethods.concat(this._otherMethods)) {
      this[method] = sinon.stub().resolves();
    }

    this._bootstrap = {
      startOrWait: sinon.stub().resolves()
    };
  }
}

module.exports = IndexStorageMock;