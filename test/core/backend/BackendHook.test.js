"use strict";

const should = require("should");
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

  describe("HookManager#register", () => {
    it("should registers a new hook", () => {
      const handler = async () => {};
      const handler_bis = async () => {};

      application.hook.register("kuzzle:state:ready", handler);
      application.hook.register("kuzzle:state:ready", handler_bis);

      should(application._hooks["kuzzle:state:ready"]).have.length(2);
      should(application._hooks["kuzzle:state:ready"][0]).be.eql(handler);
      should(application._hooks["kuzzle:state:ready"][1]).be.eql(handler_bis);
    });

    it("should throw an error if the hook handler is invalid", () => {
      should(() => {
        application.hook.register("kuzzle:state:ready", {});
      }).throwError({ id: "plugin.assert.invalid_hook" });
    });

    it("should throw an error if the application is already started", () => {
      application.started = true;

      should(() => {
        application.hook.register("kuzzle:state:ready", async () => {});
      }).throwError({ id: "plugin.runtime.already_started" });
    });
  });
});
