'use strict';

const sinon = require('sinon');
const { DebugModule } = require('../../lib/types/DebugModule');

class DebugModuleMock extends DebugModule {
  constructor () {
    super('DebugModuleMock', {
      events: ['event_foo'],
      methods: ['method_foo']
    });

    this.init = sinon.stub().resolves();
    this.cleanup = sinon.stub().resolves();
    this.method_foo = sinon.stub().resolves();
  }
}

module.exports = DebugModuleMock;