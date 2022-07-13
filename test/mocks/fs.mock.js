// Mock for node's "fs" module

"use strict";

const sinon = require("sinon");

class FsMock {
  constructor() {
    this.accessSync = sinon.stub();
    this.constants = {};
    this.copyFileSync = sinon.stub();
    this.createReadStream = sinon.stub().returns({
      pipe: sinon.stub().returnsThis(),
      on: sinon.stub().callsArgWith(1),
    });
    this.createWriteStream = sinon.stub();
    this.existsSync = sinon.stub().returns(false);
    this.lstatSync = sinon.stub().returns({
      isFile: sinon.stub().returns(true),
    });
    this.mkdirSync = sinon.stub();
    this.readdir = sinon.stub();
    this.readdirSync = sinon.stub().returns([]);
    this.removeSync = sinon.stub();
    this.stat = sinon.stub();
    this.statSync = sinon.stub();
    this.unlink = sinon.stub();
    this.unlinkSync = sinon.stub();
    this.writeFileSync = sinon.stub();
    this.readFileSync = sinon.stub();
  }
}

module.exports = FsMock;
