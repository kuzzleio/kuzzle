const
  sinon = require('sinon');

class StateManagerMock {
  constructor(node) {
    this.node = node;

    this.locks = {
      create: new Set(),
      delete: new Set(),
      sync: new Set()
    };

    this.scheduledResync = new Set();

    this.sync = sinon.stub().resolves();
    this.syncAll = sinon.stub().resolves();
    this.getVersion = sinon.stub();
    this.reset = sinon.stub().resolves();
  }

  get kuzzle () {
    return this.node.kuzzle;
  }
}

module.exports = StateManagerMock;
