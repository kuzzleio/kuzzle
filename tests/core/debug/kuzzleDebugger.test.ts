import type { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KuzzleDebugger } from "../../../lib/core/debug/kuzzleDebugger";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

/** The inspector session, as the subject uses it. */
type FakeSession = EventEmitter & {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

/**
 * The V8 inspector session the subject builds in `init()`.
 *
 * Mocked rather than reached for through the instance, because `inspector` is
 * `private` — and because a spec that really connected the session would be
 * debugging the process running it.
 */
const session = vi.hoisted(() => ({
  current: null as unknown as FakeSession,
}));

vi.mock("inspector", async () => {
  const { EventEmitter: Emitter } = await import("node:events");

  class Session extends Emitter {
    connect = vi.fn();
    disconnect = vi.fn();
    post = vi.fn(
      (
        method: string,
        params: unknown,
        callback: (error: unknown, result?: unknown) => void,
      ) => {
        callback(null, { result: "foo" });
      },
    );

    constructor() {
      super();
      session.current = this as unknown as FakeSession;
    }
  }

  return { default: { Session } };
});

describe("#core/debug/KuzzleDebugger", () => {
  let kuzzleDebugger: KuzzleDebugger;
  let bus: ReturnType<typeof stubAsk>;
  let notify: ReturnType<typeof vi.fn>;
  let sockets: Map<string, { internal: { debugSession: boolean } }>;

  beforeEach(async () => {
    notify = vi.fn();
    sockets = new Map();
    bus = stubAsk(() => undefined);

    stubKuzzle({
      ask: bus.ask,
      onAsk: bus.onAsk,
      on: vi.fn(),
      entryPoint: {
        _notify: notify,
        protocols: new Map([["websocket", { socketByConnectionId: sockets }]]),
      },
    });

    kuzzleDebugger = new KuzzleDebugger();
    await kuzzleDebugger.init();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const ask = (event: string, ...args: unknown[]) =>
    global.kuzzle.ask(event, ...args);

  describe("#init", () => {
    it.each([
      ["core:debugger:enable", []],
      ["core:debugger:disable", []],
      ["core:debugger:isEnabled", []],
    ])("should answer %s", async (event) => {
      await expect(ask(event)).resolves.not.toThrow();
    });

    it("should start disabled", async () => {
      await expect(ask("core:debugger:isEnabled")).resolves.toBe(false);
    });
  });

  describe("#enable", () => {
    it("should connect the debugger and prevent this node's eviction", async () => {
      await kuzzleDebugger.enable();

      expect(session.current.connect).toHaveBeenCalledOnce();
      await expect(ask("core:debugger:isEnabled")).resolves.toBe(true);
      expect(bus.ask).toHaveBeenCalledWith(
        "cluster:node:preventEviction",
        true,
      );
    });

    it("should only connect the debugger once", async () => {
      await kuzzleDebugger.enable();
      await kuzzleDebugger.enable();

      expect(session.current.connect).toHaveBeenCalledOnce();
    });
  });

  describe("#disable", () => {
    it("should do nothing if the debugger is not enabled", async () => {
      await kuzzleDebugger.disable();

      expect(session.current.disconnect).not.toHaveBeenCalled();
    });

    it("should disconnect the debugger and release the eviction guard", async () => {
      await kuzzleDebugger.enable();

      await kuzzleDebugger.disable();

      expect(session.current.disconnect).toHaveBeenCalledOnce();
      await expect(ask("core:debugger:isEnabled")).resolves.toBe(false);
      expect(bus.ask).toHaveBeenCalledWith(
        "cluster:node:preventEviction",
        false,
      );
    });

    it("should clear the event listeners", async () => {
      await kuzzleDebugger.enable();
      await kuzzleDebugger.addListener("EventMock.event_foo", "foobar");

      await kuzzleDebugger.disable();
      await kuzzleDebugger.enable();

      /*
       * The Mocha spec stubbed `events.clear` and asserted it had been called —
       * `events` is private. What clearing it means is that the connection is
       * no longer notified, which is the same assertion one layer out.
       */
      session.current.emit("inspectorNotification", {
        method: "EventMock.event_foo",
      });

      expect(notify).not.toHaveBeenCalled();
    });

    it("should drop the debug marker of every socket still listening", async () => {
      const socket = { internal: { debugSession: false } };
      sockets.set("foobar", socket);

      await kuzzleDebugger.enable();
      await kuzzleDebugger.addListener("EventMock.event_foo", "foobar");
      expect(socket.internal.debugSession).toBe(true);

      await kuzzleDebugger.disable();

      expect(socket.internal.debugSession).toBe(false);
    });
  });

  describe("#events", () => {
    it("should notify the connections listening to the emitted event", async () => {
      await kuzzleDebugger.enable();
      await kuzzleDebugger.addListener("notification", "foo");

      session.current.emit("inspectorNotification", {
        method: "notification",
        foo: "bar",
      });
      await vi.waitFor(() => expect(notify).toHaveBeenCalled());

      expect(notify).toHaveBeenCalledWith({
        channels: ["kuzzle-debugger-event"],
        connectionId: "foo",
        payload: {
          event: "notification",
          result: { method: "notification", foo: "bar" },
        },
      });
    });

    it('should notify every connection listening on "*"', async () => {
      await kuzzleDebugger.enable();
      await kuzzleDebugger.addListener("*", "foo");
      await kuzzleDebugger.addListener("*", "bar");

      session.current.emit("inspectorNotification", {
        method: "my-event",
        foo: "bar",
      });
      await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(2));

      for (const connectionId of ["foo", "bar"]) {
        expect(notify).toHaveBeenCalledWith({
          channels: ["kuzzle-debugger-event"],
          connectionId,
          payload: {
            event: "my-event",
            result: { method: "my-event", foo: "bar" },
          },
        });
      }
    });

    it("should notify nothing while the debugger is disabled", async () => {
      session.current.emit("inspectorNotification", { method: "notification" });
      await new Promise((resolve) => setImmediate(resolve));

      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe("#post", () => {
    it("should throw if the debugger is not enabled", async () => {
      const rejection = kuzzleDebugger.post("Debugger.enable");

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.debugger.not_enabled",
      });
    });

    it("should call the method through the CDP", async () => {
      await kuzzleDebugger.enable();

      await kuzzleDebugger.post("Debugger.enable");

      expect(session.current.post).toHaveBeenCalledWith(
        "Debugger.enable",
        {},
        expect.any(Function),
      );
    });

    it("should resolve the inspector's result", async () => {
      await kuzzleDebugger.enable();

      await expect(kuzzleDebugger.post("method", {})).resolves.toEqual({
        result: "foo",
      });
    });

    it("should format an inspector error rather than reject", async () => {
      await kuzzleDebugger.enable();
      session.current.post.mockImplementation(
        (
          method: string,
          params: unknown,
          callback: (error: unknown, result?: unknown) => void,
        ) => callback({ message: "foo" }, null),
      );

      await expect(kuzzleDebugger.post("method", {})).resolves.toEqual({
        error:
          '{"message":{"value":"foo","writable":true,"enumerable":true,"configurable":true}}',
      });
    });

    it("should turn reportProgress off, and fake the event Chrome waits for", async () => {
      await kuzzleDebugger.enable();
      const notified = vi.fn();
      session.current.on("inspectorNotification", notified);

      await kuzzleDebugger.post("HeapProfiler.takeHeapSnapshot", {
        reportProgress: true,
      });

      expect(notified).toHaveBeenCalledWith({
        method: "HeapProfiler.reportHeapSnapshotProgress",
        params: { done: 0, finished: true, total: 0 },
      });
      // The parameter itself is turned off: it segfaults the inspected process.
      expect(session.current.post).toHaveBeenCalledWith(
        "HeapProfiler.takeHeapSnapshot",
        { reportProgress: false },
        expect.any(Function),
      );
    });
  });

  describe("#addListener", () => {
    it("should throw if the debugger is not enabled", async () => {
      const rejection = kuzzleDebugger.addListener(
        "EventMock.event_foo",
        "foobar",
      );

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.debugger.not_enabled",
      });
    });

    it("should mark the socket as a debugging one", async () => {
      const socket = { internal: { debugSession: false } };
      sockets.set("foobar", socket);

      await kuzzleDebugger.enable();
      await kuzzleDebugger.addListener("EventMock.event_foo", "foobar");

      expect(socket.internal.debugSession).toBe(true);
    });
  });

  describe("#removeListener", () => {
    it("should throw if the debugger is not enabled", async () => {
      const rejection = kuzzleDebugger.removeListener(
        "EventMock.event_foo",
        "foobar",
      );

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.debugger.not_enabled",
      });
    });

    it("should stop notifying the connection", async () => {
      await kuzzleDebugger.enable();
      await kuzzleDebugger.addListener("EventMock.event_foo", "foobar");

      await kuzzleDebugger.removeListener("EventMock.event_foo", "foobar");

      session.current.emit("inspectorNotification", {
        method: "EventMock.event_foo",
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(notify).not.toHaveBeenCalled();
    });

    it("should keep the debug marker while the connection listens to something else", async () => {
      const socket = { internal: { debugSession: false } };
      sockets.set("foobar", socket);

      await kuzzleDebugger.enable();
      await kuzzleDebugger.addListener("EventMock.event_foo", "foobar");
      await kuzzleDebugger.addListener("EventMock.event_bar", "foobar");

      await kuzzleDebugger.removeListener("EventMock.event_foo", "foobar");
      expect(socket.internal.debugSession).toBe(true);

      await kuzzleDebugger.removeListener("EventMock.event_bar", "foobar");
      expect(socket.internal.debugSession).toBe(false);
    });
  });
});
