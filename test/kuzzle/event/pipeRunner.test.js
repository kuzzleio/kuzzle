"use strict";

const assert = require("assert");
const should = require("should");
const sinon = require("sinon");

const PipeRunner = require("../../../lib/kuzzle/event/pipeRunner");
const {
  BadRequestError,
  PluginImplementationError,
  ServiceUnavailableError,
} = require("../../../index");

class RemoteControlledPipe {
  constructor() {
    this._callback = null;
    this.fn = (...args) => {
      this._callback = args.pop();
    };
  }

  get callback() {
    assert(typeof this._callback === "function", new Error("Invalid callback"));
    return this._callback;
  }

  get chain() {
    return [this.fn];
  }

  resolve(...data) {
    this.callback(null, ...data);
  }

  reject(error) {
    this.callback(error);
  }
}

describe("#pipeRunner", () => {
  let clock;
  let pipeRunner;
  let maxConcurrentPipes;
  let bufferSize;
  let remoteControlledPipe;

  beforeEach(() => {
    maxConcurrentPipes = 50;
    bufferSize = 50000;
    pipeRunner = new PipeRunner(maxConcurrentPipes, bufferSize);
    remoteControlledPipe = new RemoteControlledPipe();

    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  describe("#constructor", () => {
    it("should throw if an invalid number of max concurrent request is provided", () => {
      for (const invalid of [-1, [], {}, 0, null, undefined, "URGH"]) {
        should(() => new PipeRunner(invalid, 123)).throw(
          "Cannot instantiate pipes executor: invalid maxConcurrentPipes parameter value"
        );
      }
    });

    it("should throw if an invalid buffer size is provided", () => {
      for (const invalid of [-1, [], {}, 0, null, undefined, "URGH"]) {
        should(() => new PipeRunner(123, invalid)).throw(
          "Cannot instantiate pipes executor: invalid pipesBufferSize parameter value"
        );
      }
    });
  });

  describe("#run", () => {
    it("should run a pipe immediately if there is space", () => {
      should(pipeRunner.running).eql(0);

      pipeRunner.run(remoteControlledPipe.chain, ["bar"], (err, res) => {
        should(err).be.null();
        should(res).eql("foo");
      });

      should(pipeRunner.running).eql(1);
      should(pipeRunner.buffer.length).eql(0);

      remoteControlledPipe.resolve("foo");

      clock.runAll();

      should(pipeRunner.running).eql(0);
    });

    it("should forward a KuzzleError unchanged", () => {
      const error = new BadRequestError("oh noes");

      should(pipeRunner.running).eql(0);

      pipeRunner.run(remoteControlledPipe.chain, ["bar"], (err) => {
        should(err).eql(error);
      });

      should(pipeRunner.running).eql(1);
      should(pipeRunner.buffer.length).eql(0);

      remoteControlledPipe.reject(error);

      clock.runAll();

      should(pipeRunner.running).eql(0);
    });

    it("should return an unexpected error if a non-kuzzle error is returned", () => {
      const error = new Error("oh noes");

      should(pipeRunner.running).eql(0);

      pipeRunner.run(remoteControlledPipe.chain, ["bar"], (err) => {
        should(err).instanceof(PluginImplementationError);
        should(err.message).containEql(error.message);
        should(err.id).eql("plugin.runtime.unexpected_error");
      });

      should(pipeRunner.running).eql(1);
      should(pipeRunner.buffer.length).eql(0);

      remoteControlledPipe.reject(error);

      clock.runAll();

      should(pipeRunner.running).eql(0);
    });

    it("should bufferize and replay pipes if there are no more slots available", () => {
      const runCB = (err, res) => {
        should(err).be.null();
        should(res).eql("foo");
      };

      pipeRunner.running = maxConcurrentPipes - 1;
      should(pipeRunner.buffer.length).eql(0);

      pipeRunner.run(remoteControlledPipe.chain, ["bar"], runCB, {});

      should(pipeRunner.running).eql(maxConcurrentPipes);
      should(pipeRunner.buffer.length).eql(0);

      const remoteControlledPipe2 = new RemoteControlledPipe();

      pipeRunner.run(remoteControlledPipe2.chain, ["qux"], runCB, {});

      should(pipeRunner.running).eql(maxConcurrentPipes);
      should(pipeRunner.buffer.length).eql(1);

      clock.runAll();

      remoteControlledPipe.resolve("foo");

      clock.runAll();

      should(pipeRunner.running).eql(maxConcurrentPipes);
      should(pipeRunner.buffer.length).eql(0);

      remoteControlledPipe2.resolve("foo");

      clock.runAll();

      should(pipeRunner.running).eql(maxConcurrentPipes - 1);
      should(pipeRunner.buffer.length).eql(0);
    });

    it("should reject the callback immediately if there is no room left in the buffer", () => {
      pipeRunner.running = maxConcurrentPipes;
      pipeRunner.buffer = { length: bufferSize };

      pipeRunner.run(remoteControlledPipe.chain, ["bar"], (err) => {
        should(err).instanceof(ServiceUnavailableError);
        should(err.id).eql("plugin.runtime.too_many_pipes");
        should(remoteControlledPipe._callback).be.null();
      });

      clock.runAll();
    });
  });

  describe("#_runNext", () => {
    beforeEach(() => {
      sinon.stub(pipeRunner, "run");
    });

    it("should resubmit the first item of the buffer", () => {
      const chain = { chain: "foo", args: ["bar"], callback: sinon.stub() };
      pipeRunner.buffer.push(chain);
      pipeRunner.buffer.push({
        chain: "bar",
        args: ["oh"],
        callback: sinon.stub(),
      });
      pipeRunner.buffer.push({
        chain: "baz",
        args: ["noes"],
        callback: sinon.stub(),
      });

      pipeRunner._runNext();

      should(pipeRunner.buffer.length).eql(2);
      should(pipeRunner.run)
        .calledOnce()
        .calledWith(chain.chain, chain.args, chain.callback);
    });

    it("should skip if the buffer is empty", () => {
      pipeRunner._runNext();

      should(pipeRunner.buffer.length).eql(0);
      should(pipeRunner.run).not.called();
    });

    it("should skip if there are already too many pipes running", () => {
      pipeRunner.buffer.push({
        chain: "foo",
        args: ["qux"],
        callback: sinon.stub(),
      });
      pipeRunner.buffer.push({
        chain: "bar",
        args: ["qux"],
        callback: sinon.stub(),
      });
      pipeRunner.buffer.push({
        chain: "baz",
        args: ["qux"],
        callback: sinon.stub(),
      });

      pipeRunner.running = maxConcurrentPipes;

      pipeRunner._runNext();

      should(pipeRunner.buffer.length).eql(3);
      should(pipeRunner.run).not.called();
    });
  });
});
