"use strict";

const sinon = require("sinon");

module.exports = {
  registerHandler: sinon.stub(),
  segfault: sinon.stub(),
  printNativeStacktraces: sinon.stub(),
};
