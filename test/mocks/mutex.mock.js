"use strict";

// to be used with mock-require to mock the Mutex class

const assert = require("assert");

const sinon = require("sinon");

const { Mutex } = require("../../lib/util/mutex");

// allow unit tests to control the result of "lock"
let lockResult = true;

// accessor to the latest mutex created, allowing to test how it is used
let lastMutex = null;

class MutexMock extends Mutex {
  constructor(id, options) {
    super(id, options);

    sinon.stub(this, "lock").resolves(lockResult);
    sinon.stub(this, "unlock").resolves();

    lastMutex = this;
  }

  static __canLock(value) {
    assert(
      typeof value === "boolean",
      "Mutex.lock can only return a boolean value"
    );
    lockResult = value;
  }

  static __getLastMutex() {
    return lastMutex;
  }
}

module.exports = MutexMock;
