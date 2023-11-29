"use strict";

const should = require("should");
const sinon = require("sinon");
const mockrequire = require("mock-require");

const KuzzleMock = require("../../mocks/kuzzle.mock");

describe("Backend", () => {
  let application;
  let Backend;

  beforeEach(() => {
    mockrequire("../../../lib/kuzzle", KuzzleMock);

    ({ Backend } = mockrequire.reRequire("../../../lib/core/backend/backend"));

    application = new Backend("black-mesa");
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe("BackendPipe#register", () => {
    it("should registers a new pipe", () => {
      const handler = async () => {};
      const handler_bis = async () => {};

      application.pipe.register("kuzzle:state:ready", handler);
      application.pipe.register("kuzzle:state:ready", handler_bis);

      // The first pipe is the one who set "started: true"
      should(application._pipes["kuzzle:state:ready"]).have.length(3);
      should(application._pipes["kuzzle:state:ready"][1]).be.eql(handler);
      should(application._pipes["kuzzle:state:ready"][2]).be.eql(handler_bis);
    });

    it("should throw an error if the pipe handler is invalid", () => {
      should(() => {
        application.pipe.register("kuzzle:state:ready", {});
      }).throwError({ id: "plugin.assert.invalid_pipe" });
    });

    it("should throw an error if the application is already started without opt-in dynamic option", () => {
      application.started = true;

      should(() => {
        application.pipe.register("kuzzle:state:ready", async () => {});
      }).throwError({ id: "plugin.runtime.already_started" });
    });

    it("should allows to register pipe at runtime with opt-in dynamic option", () => {
      const handler = async () => {};
      application.started = true;
      global.kuzzle = {
        pluginsManager: {
          registerPipe: sinon.stub().returns("pipe-unique-id"),
        },
      };

      const pipeId = application.pipe.register("kuzzle:state:ready", handler, {
        dynamic: true,
      });

      should(pipeId).be.eql("pipe-unique-id");
      should(global.kuzzle.pluginsManager.registerPipe).be.calledWith(
        global.kuzzle.pluginsManager.application,
        "kuzzle:state:ready",
        handler,
      );
    });
  });

  describe("BackendPipe#unregister", () => {
    it("should allows to unregister a dynamic pipe", () => {
      application.started = true;
      global.kuzzle = {
        pluginsManager: {
          unregisterPipe: sinon.stub(),
        },
      };

      application.pipe.unregister("unique-pipe-id");

      should(global.kuzzle.pluginsManager.unregisterPipe).be.calledWith(
        "unique-pipe-id",
      );
    });

    it("should throw an error if the application is not started", () => {
      application.started = false;

      should(() => {
        application.pipe.unregister("unique-pipe-id");
      }).throwError({ id: "plugin.runtime.unavailable_before_start" });
    });
  });
});
