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

  describe("ConfigManager#set", () => {
    it("should allows to set a configuration value", () => {
      application.config.set("server.http.enabled", false);

      should(application.config.content.server.http.enabled).be.false();
    });

    it("should throw an error if the application is already started", () => {
      application.started = true;

      should(() => {
        application.config.set("server.http.enabled", false);
      }).throwError({ id: "plugin.runtime.already_started" });
    });
  });

  describe("ConfigManager#merge", () => {
    it("should allows to merge configuration values", () => {
      application.config.merge({
        server: { http: { enabled: false } },
      });

      should(application.config.content.server.http.enabled).be.false();
    });

    it("should throw an error if the application is already started", () => {
      application.started = true;

      should(() => {
        application.config.merge({
          server: { http: { enabled: false } },
        });
      }).throwError({ id: "plugin.runtime.already_started" });
    });
  });
});
