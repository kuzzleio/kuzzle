"use strict";

const should = require("should");

const { Request, InternalError } = require("../../../index");
const { DebugController } = require("../../../lib/api/controllers");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const set = require("lodash/set");

describe("Test: debug controller", () => {
  let debugController;
  let kuzzle;

  beforeEach(async () => {
    kuzzle = new KuzzleMock();
    debugController = new DebugController();
    set(kuzzle, "config.security.debug.native_debug_protocol", true);

    await debugController.init();
  });

  describe("#enable", () => {
    it("should connect the debugger", async () => {
      await debugController.enable();

      await should(kuzzle.ask).be.calledWith("core:debugger:enable");
    });
  });

  describe("#disable", () => {
    it("should do nothing if the debugger is not enabled", async () => {
      await debugController.disable();

      await should(kuzzle.ask).be.calledWith("core:debugger:disable");
    });
  });

  describe("#post", () => {
    let request;
    beforeEach(async () => {
      request = new Request({});
    });

    it("should ask 'core:debugger:post' with method and params", async () => {
      request.input.body = {
        method: "Debugger.enable",
      };
      await debugController.post(request);

      await should(kuzzle.ask).be.calledWith(
        "core:debugger:post",
        "Debugger.enable"
      );
    });
  });

  describe("#addListener", () => {
    let request;
    beforeEach(async () => {
      request = new Request({});
      request.context.connection.protocol = "websocket";
    });

    it("should throw if the request is sent with another protocol than Websocket", async () => {
      request.context.connection.protocol = "http";
      await should(debugController.addListener(request)).be.rejectedWith(
        InternalError,
        { id: "api.assert.unsupported_protocol" }
      );
    });

    it("should ask 'core:debugger:addListener' with the event and connectionId", async () => {
      request.input.body = {
        event: "EventMock.event_foo",
      };
      request.context.connection.id = "foobar";

      await debugController.addListener(request);
      await should(kuzzle.ask).be.calledWith(
        "core:debugger:addListener",
        "EventMock.event_foo",
        "foobar"
      );
    });
  });

  describe("#removeListener", () => {
    let request;
    beforeEach(async () => {
      request = new Request({});
      request.context.connection.protocol = "websocket";
    });

    it("should throw if the request is sent with another protocol than Websocket", async () => {
      request.context.connection.protocol = "http";
      await should(debugController.removeListener(request)).be.rejectedWith(
        InternalError,
        { id: "api.assert.unsupported_protocol" }
      );
    });

    it("should ask 'core:debugger:removeListener' with the event and connectionId", async () => {
      request.input.body = {
        event: "EventMock.event_foo",
      };
      request.context.connection.id = "foobar";

      await debugController.removeListener(request);
      await should(kuzzle.ask).be.calledWith(
        "core:debugger:removeListener",
        "EventMock.event_foo",
        "foobar"
      );
    });
  });
});
