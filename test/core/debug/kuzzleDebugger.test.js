"use strict";

const should = require("should");
const sinon = require("sinon");

const { PreconditionError } = require("../../../index");
const { KuzzleDebugger } = require("../../../lib/core/debug/kuzzleDebugger");
const KuzzleMock = require("../../mocks/kuzzle.mock");

describe("Test: Kuzzle Debugger", () => {
  let kuzzleDebugger;
  let kuzzle;

  beforeEach(async () => {
    kuzzle = new KuzzleMock();
    kuzzleDebugger = new KuzzleDebugger();

    await kuzzleDebugger.init();
  });

  describe("#events", () => {
    it("should listen to events from inspectorNotification and send notification to websocket connections listening", async () => {
      kuzzleDebugger.debuggerStatus = true;

      kuzzleDebugger.notifyGlobalListeners = sinon.stub().resolves();

      let resolve;
      const promise = new Promise((res) => {
        resolve = res;
      });
      kuzzleDebugger.notifyConnection = sinon.stub().callsFake(async () => {
        resolve();
      });
      kuzzleDebugger.events.set("notification", new Set(["foo"]));

      kuzzleDebugger.inspector.emit("inspectorNotification", {
        method: "notification",
        foo: "bar",
      });

      await promise;

      await should(kuzzleDebugger.notifyGlobalListeners).be.calledWith(
        "notification",
        {
          method: "notification",
          foo: "bar",
        }
      );

      await should(kuzzleDebugger.notifyConnection)
        .be.calledOnce()
        .and.be.calledWith("foo", "kuzzle-debugger-event", {
          event: "notification",
          result: {
            method: "notification",
            foo: "bar",
          },
        });
    });
  });

  describe("#enable", () => {
    it("should connect the debugger", async () => {
      sinon.stub(kuzzleDebugger.inspector, "connect").returns();
      await kuzzleDebugger.enable();

      await should(kuzzleDebugger.inspector.connect).be.calledOnce();

      should(kuzzleDebugger.debuggerStatus).be.true();
    });

    it("should only connect the debugger once", async () => {
      sinon.stub(kuzzleDebugger.inspector, "connect").returns();

      await kuzzleDebugger.enable();
      await kuzzleDebugger.enable();

      await should(kuzzleDebugger.inspector.connect).be.calledOnce();
    });
  });

  describe("#disable", () => {
    it("should do nothing if the debugger is not enabled", async () => {
      sinon.stub(kuzzleDebugger.inspector, "disconnect").returns();

      kuzzleDebugger.debuggerStatus = false;

      await kuzzleDebugger.disable();

      await should(kuzzleDebugger.inspector.disconnect).not.be.called();
    });

    it("should disconnect the debugger", async () => {
      sinon.stub(kuzzleDebugger.inspector, "disconnect").returns();

      kuzzleDebugger.debuggerStatus = true;

      await kuzzleDebugger.disable();

      await should(kuzzleDebugger.inspector.disconnect).be.calledOnce();

      await should(kuzzleDebugger.debuggerStatus).be.false();
    });

    it("should clear the event map and post methods map", async () => {
      sinon.stub(kuzzleDebugger.inspector, "disconnect").returns();

      kuzzleDebugger.debuggerStatus = true;
      const clearEventStub = sinon
        .stub(kuzzleDebugger.events, "clear")
        .returns();

      await kuzzleDebugger.disable();
      await should(clearEventStub).be.calledOnce();
    });
  });

  describe("#post", () => {
    beforeEach(async () => {
      await kuzzleDebugger.enable();
    });

    it("should throw if the debugger is not enabled", async () => {
      kuzzleDebugger.debuggerStatus = false;

      await should(kuzzleDebugger.post("Debugger.enable")).be.rejectedWith(
        PreconditionError,
        { id: "core.debugger.not_enabled" }
      );
    });

    it("should call the method from the CDP", async () => {
      kuzzleDebugger.inspectorPost = sinon.stub();
      kuzzle.config.security.debug.native_debug_protocol = true;
      await kuzzleDebugger.post("Debugger.enable");

      await should(kuzzleDebugger.inspectorPost).be.calledWithMatch(
        "Debugger.enable",
        {}
      );
    });
  });

  describe("#addListener", () => {
    beforeEach(async () => {
      await kuzzleDebugger.enable();
    });

    it("should throw if the debugger is not enabled", async () => {
      kuzzleDebugger.debuggerStatus = false;
      await should(
        kuzzleDebugger.addListener("EventMock.event_foo", "foobar")
      ).be.rejectedWith(PreconditionError, { id: "core.debugger.not_enabled" });
    });

    it("should add the connectionId to the list of listener for the requested event", async () => {
      await kuzzleDebugger.addListener("EventMock.event_foo", "foobar");
      should(kuzzleDebugger.events.get("EventMock.event_foo")).be.eql(
        new Set(["foobar"])
      );
    });
  });

  describe("#removeListener", () => {
    beforeEach(async () => {
      await kuzzleDebugger.enable();
    });

    it("should throw if the debugger is not enabled", async () => {
      kuzzleDebugger.debuggerStatus = false;
      await should(
        kuzzleDebugger.removeListener("EventMock.event_foo", "foobar")
      ).be.rejectedWith(PreconditionError, { id: "core.debugger.not_enabled" });
    });

    it("should remove the connectionId from the list of listener for the requested event", async () => {
      kuzzleDebugger.events = new Map([
        ["EventMock.event_foo", new Set(["foobar"])],
      ]);
      await kuzzleDebugger.removeListener("EventMock.event_foo", "foobar");
      should(kuzzleDebugger.events.get("EventMock.event_foo")).be.eql(
        new Set([])
      );
    });
  });

  describe("#inspectorPost", () => {
    beforeEach(async () => {
      await kuzzleDebugger.enable();
    });

    it("should throw if the debugger is not enabled", async () => {
      kuzzleDebugger.debuggerStatus = false;
      await should(kuzzleDebugger.inspectorPost("method", {})).be.rejectedWith(
        PreconditionError,
        { id: "core.debugger.not_enabled" }
      );
    });

    it("should resolve the result of the post to the inspector using the CDP", async () => {
      const stub = sinon
        .stub(kuzzleDebugger.inspector, "post")
        .callsFake((method, params, callback) => {
          callback(null, { result: "foo" });
        });

      const result = await kuzzleDebugger.inspectorPost("method", {});

      should(stub)
        .be.calledOnce()
        .and.be.calledWith("method", {}, sinon.match.func);

      should(result).be.eql({
        result: "foo",
      });
    });

    it("should format and resolve the error of the post to the inspector using the CDP", async () => {
      const stub = sinon
        .stub(kuzzleDebugger.inspector, "post")
        .callsFake((method, params, callback) => {
          callback({ message: "foo" }, null);
        });

      const result = await kuzzleDebugger.inspectorPost("method", {});

      should(stub)
        .be.calledOnce()
        .and.be.calledWith("method", {}, sinon.match.func);

      should(result).be.eql({
        error:
          '{"message":{"value":"foo","writable":true,"enumerable":true,"configurable":true}}',
      });
    });
  });

  describe("#notifyConnection", () => {
    it("should call entrypoint._notify", async () => {
      kuzzle.entryPoint._notify = sinon.stub().returns();
      global.kuzzle = kuzzle;

      await kuzzleDebugger.notifyConnection("foobar", "my-event", {
        foo: "bar",
      });

      should(kuzzle.entryPoint._notify).be.calledWith({
        channels: ["my-event"],
        connectionId: "foobar",
        payload: { foo: "bar" },
      });
    });
  });

  describe("#notifyGlobalListeners", () => {
    it('should notify every connections listening on "*"', async () => {
      kuzzleDebugger.events = new Map([["*", new Set(["foo", "bar"])]]);

      sinon.stub(kuzzleDebugger, "notifyConnection").resolves();
      await kuzzleDebugger.notifyGlobalListeners("my-event", { foo: "bar" });

      should(kuzzleDebugger.notifyConnection).be.calledTwice();
      should(kuzzleDebugger.notifyConnection).be.calledWith(
        "foo",
        "kuzzle-debugger-event",
        { event: "my-event", result: { foo: "bar" } }
      );
      should(kuzzleDebugger.notifyConnection).be.calledWith(
        "bar",
        "kuzzle-debugger-event",
        { event: "my-event", result: { foo: "bar" } }
      );
    });
  });
});
