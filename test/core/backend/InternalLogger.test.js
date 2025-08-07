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

  describe("Logger", () => {
    describe("#_log", () => {
      it("should exposes log methods and call kuzzle ones", async () => {
        await application.start();

        application.log.debug("debug");
        application.log.info("info");
        application.log.warn("warn");
        application.log.error("error");
        application.log.verbose({ info: "verbose" });

        should(global.kuzzle.log.debug).be.calledWith("debug");
        should(global.kuzzle.log.info).be.calledWith("info");
        should(global.kuzzle.log.warn).be.calledWith("warn");
        should(global.kuzzle.log.error).be.calledWith("error");
        should(global.kuzzle.log.verbose).be.calledWith({ info: "verbose" });
      });
    });
  });
});
