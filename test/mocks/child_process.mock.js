"use strict";
const sinon = require("sinon");
const EventEmitter = require("eventemitter3");

class ChildProcessMock extends EventEmitter {
  constructor(path) {
    super();
    this.path = path;
    this.send = sinon.stub();
    this.connected =  true;
    this.killed = false;
    this.channel = {};
  }
}

module.exports = ChildProcessMock;
