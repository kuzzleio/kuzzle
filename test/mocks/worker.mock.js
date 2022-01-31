'use strict';
const sinon = require('sinon');
const EventEmitter = require('eventemitter3');

class WorkerMock extends EventEmitter {
  constructor (path) {
    super();
    this.path = path;
    this.unref = sinon.stub();
    this.postMessage = sinon.stub();
  }
}

module.exports = WorkerMock;