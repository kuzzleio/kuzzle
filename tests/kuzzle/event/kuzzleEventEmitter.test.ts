import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalError as KuzzleInternalError } from "../../../lib/kerror/errors/internalError";
import KuzzleEventEmitter from "../../../lib/kuzzle/event/KuzzleEventEmitter";
import { invalid } from "../../helpers/invalid";
import { settle } from "../../helpers/settle";

/** A plugin pipe in callback form: answers `result` through its callback. */
const yields = (result?: unknown) =>
  vi.fn((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      error: unknown,
      result?: unknown,
    ) => void;

    callback(null, result);
  });

/** What a pipe handler was called with, minus the trailing callback. */
const payloadOf = (handler: ReturnType<typeof yields>, call = 0) =>
  (handler.mock.calls[call] ?? []).slice(0, -1);

/** Lets every already-scheduled callback run, in place of Mocha's `done`. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("#kuzzle/event/KuzzleEventEmitter", () => {
  let emitter: KuzzleEventEmitter;

  beforeEach(() => {
    emitter = new KuzzleEventEmitter(10, 50);
  });

  describe("#hooks", () => {
    it('should trigger hooks with wildcarded "before" events', () => {
      const exact = vi.fn();
      const wildcard = vi.fn();
      const before = vi.fn();

      emitter.on("foo:*", wildcard);
      emitter.on("foo:before*", before);
      emitter.on("foo:beforeBarQux", exact);
      emitter.registerPluginHook("plugin-foobar", "foo:*", wildcard);
      emitter.registerPluginHook("plugin-foobar", "foo:before*", before);
      emitter.registerPluginHook("plugin-foobar", "foo:beforeBarQux", exact);

      emitter.emit("foo:beforeBarQux");

      expect(exact).toHaveBeenCalledTimes(2);
      expect(wildcard).toHaveBeenCalledTimes(2);
      expect(before).toHaveBeenCalledTimes(2);
    });

    it('should trigger hooks with wildcarded "after" events', () => {
      const exact = vi.fn();
      const wildcard = vi.fn();
      const after = vi.fn();

      emitter.on("foo:*", wildcard);
      emitter.on("foo:after*", after);
      emitter.on("foo:afterBarQux", exact);
      emitter.registerPluginHook("plugin-foobar", "foo:*", wildcard);
      emitter.registerPluginHook("plugin-foobar", "foo:after*", after);
      emitter.registerPluginHook("plugin-foobar", "foo:afterBarQux", exact);

      emitter.emit("foo:afterBarQux");

      expect(exact).toHaveBeenCalledTimes(2);
      expect(wildcard).toHaveBeenCalledTimes(2);
      expect(after).toHaveBeenCalledTimes(2);
    });

    it("should trigger hooks even on non-wildcardable events", () => {
      const exact = vi.fn();
      const globalWildcard = vi.fn();

      emitter.on("fooafterBar", exact);
      emitter.on("*", globalWildcard);
      emitter.registerPluginHook("plugin-foobar", "fooafterBar", exact);
      emitter.registerPluginHook("plugin-foobar", "*", globalWildcard);

      emitter.emit("fooafterBar");

      expect(exact).toHaveBeenCalledTimes(2);
      expect(globalWildcard).not.toHaveBeenCalled();
    });

    it("should catch errors thrown by a hook and emit hook:onError", async () => {
      const exception = new Error("exception");
      const rejection = new Error("rejection");
      const hookOnError = vi.fn();
      const throws = vi.fn(() => {
        throw exception;
      });
      const rejects = vi.fn(async () => {
        throw rejection;
      });

      emitter.on("hook:onError", hookOnError);
      emitter.registerPluginHook("plugin-foobar", "foo:throw", throws);
      emitter.registerPluginHook("plugin-foobar", "foo:reject", rejects);

      emitter.emit("foo:throw");
      emitter.emit("foo:reject");

      await flush();

      expect(hookOnError).toHaveBeenCalledWith({
        pluginName: "plugin-foobar",
        event: "foo:throw",
        error: exception,
      });
      expect(hookOnError).toHaveBeenCalledWith({
        pluginName: "plugin-foobar",
        event: "foo:reject",
        error: rejection,
      });
    });

    it("should not loop on the hook:onError event", async () => {
      const infiniteLoopHook = vi.fn();
      const hookOnError = vi.fn(() => {
        throw new Error("exception");
      });

      emitter.on("plugin:hook:loop-error", infiniteLoopHook);
      emitter.registerPluginHook("plugin-foobar", "hook:onError", hookOnError);

      emitter.emit(
        "hook:onError",
        "plugin-foobar",
        "foo:bar",
        new Error("error"),
      );

      await flush();

      expect(hookOnError).toHaveBeenCalledOnce();
      expect(infiniteLoopHook).toHaveBeenCalledOnce();
    });

    it("should be able to have multiple handles on the same hook", () => {
      const exact = vi.fn();

      emitter.on("foo:bar", exact);
      emitter.on("foo:bar", exact);
      emitter.registerPluginHook("plugin-foobar", "foo:bar", exact);
      emitter.registerPluginHook("plugin-foobar", "foo:bar", exact);

      emitter.emit("foo:bar");

      expect(exact).toHaveBeenCalledTimes(4);
    });
  });

  describe("#pipes", () => {
    it("should return a promise by default", async () => {
      const pipe = vi.fn(async () => undefined);

      emitter.on("foo:bar", pipe);

      const result = emitter.pipe("foo:bar", "foobar");

      /* A thenable, not a native Promise: `Promback` defers through bluebird,
       * which is what `should(...).be.a.Promise()` accepted too. */
      expect(result).toHaveProperty("then", expect.any(Function));
      await expect(result).resolves.toBe("foobar");

      expect(pipe).toHaveBeenCalledOnce();
      expect(pipe).toHaveBeenCalledWith("foobar");
    });

    it("should be able to accept a callback instead of returning a promise", async () => {
      const pipe = vi.fn(async () => undefined);

      emitter.on("foo:bar", pipe);

      let returned: unknown;

      /*
       * The callback fires *during* `pipe()`, before the assignment below —
       * so the Mocha spec's `should(res).not.be.a.Promise()`, written inside
       * the callback, was asserting on `undefined` and held whatever `pipe()`
       * returned. Asserting after the callback has settled is what makes it
       * about the return value.
       */
      const answered = settle<unknown[]>((resolve) => {
        returned = emitter.pipe("foo:bar", "foobar", (...args: unknown[]) =>
          resolve(args),
        );
      });

      expect(await answered).toEqual([null, "foobar"]);
      expect(returned).toBeNull();
      expect(pipe).toHaveBeenCalledOnce();
      expect(pipe).toHaveBeenCalledWith("foobar");
    });

    it("should pass the right number of arguments between pipes", async () => {
      const pipe1 = yields("pipe1");
      const pipe2 = yields("pipe2");
      const pipe3 = yields("pipe3");

      emitter.registerPluginPipe("foo:bar", pipe1);
      emitter.registerPluginPipe("foo:bar", pipe2);
      emitter.registerPluginPipe("foo:bar", pipe3);

      const result = await emitter.pipe("foo:bar", "foo", "bar", "baz");

      expect(pipe1).toHaveBeenCalledOnce();
      expect(pipe2).toHaveBeenCalledOnce();
      expect(pipe3).toHaveBeenCalledOnce();
      // Each pipe receives the previous one's result in place of the first
      // argument, and the trailing callback the assertion drops.
      expect(payloadOf(pipe1)).toEqual(["foo", "bar", "baz"]);
      expect(payloadOf(pipe2)).toEqual(["pipe1", "bar", "baz"]);
      expect(payloadOf(pipe3)).toEqual(["pipe2", "bar", "baz"]);
      expect(result).toBe("pipe3");
    });

    it('should trigger plugin pipes with wildcarded "before" events', async () => {
      const exact = yields();
      const wildcard = yields();
      const before = yields();

      emitter.registerPluginPipe("foo:*", wildcard);
      emitter.registerPluginPipe("foo:before*", before);
      emitter.registerPluginPipe("foo:beforeBarQux", exact);

      await emitter.pipe("foo:beforeBarQux");

      expect(exact).toHaveBeenCalledOnce();
      expect(wildcard).toHaveBeenCalledOnce();
      expect(before).toHaveBeenCalledOnce();
    });

    it("should trigger core pipes with only exact events", async () => {
      const exact = vi.fn(async () => undefined);
      const wildcard = vi.fn(async () => undefined);
      const before = vi.fn(async () => undefined);

      emitter.onPipe("foo:*", wildcard);
      emitter.onPipe("foo:before*", before);
      emitter.onPipe("foo:beforeBarQux", exact);

      await emitter.pipe("foo:beforeBarQux");

      expect(exact).toHaveBeenCalledOnce();
      expect(wildcard).not.toHaveBeenCalled();
      expect(before).not.toHaveBeenCalled();
    });

    it('should trigger plugin pipes with wildcarded "after" events', async () => {
      const exact = yields();
      const wildcard = yields();
      const after = yields();

      emitter.registerPluginPipe("foo:*", wildcard);
      emitter.registerPluginPipe("foo:after*", after);
      emitter.registerPluginPipe("foo:afterBarQux", exact);

      await emitter.pipe("foo:afterBarQux");

      expect(exact).toHaveBeenCalledOnce();
      expect(wildcard).toHaveBeenCalledOnce();
      expect(after).toHaveBeenCalledOnce();
    });

    it('should trigger core pipes with only exact "after" events', async () => {
      const exact = vi.fn(async () => undefined);
      const wildcard = vi.fn(async () => undefined);
      const after = vi.fn(async () => undefined);

      emitter.onPipe("foo:*", wildcard);
      emitter.onPipe("foo:after*", after);
      emitter.onPipe("foo:afterBarQux", exact);

      await emitter.pipe("foo:afterBarQux");

      expect(exact).toHaveBeenCalledOnce();
      expect(wildcard).not.toHaveBeenCalled();
      expect(after).not.toHaveBeenCalled();
    });

    it("should trigger pipes even on non-wildcardable events", async () => {
      const exactPlugin = yields();
      const exactCore = vi.fn(async () => undefined);
      const globalWildcard = vi.fn();

      emitter.onPipe("fooafterBar", exactCore);
      emitter.onPipe("*", globalWildcard);
      emitter.registerPluginPipe("fooafterBar", exactPlugin);
      emitter.registerPluginPipe("*", globalWildcard);

      await emitter.pipe("fooafterBar");

      expect(exactPlugin).toHaveBeenCalledOnce();
      expect(exactCore).toHaveBeenCalledOnce();
      expect(globalWildcard).not.toHaveBeenCalled();
    });

    it("should be able to trigger multiple pipes on the same event", async () => {
      const exactPlugin = yields();
      const exactCore = vi.fn(async () => undefined);

      emitter.onPipe("foo:bar", exactCore);
      emitter.onPipe("foo:bar", exactCore);
      emitter.registerPluginPipe("foo:bar", exactPlugin);
      emitter.registerPluginPipe("foo:bar", exactPlugin);

      await emitter.pipe("foo:bar");

      expect(exactPlugin).toHaveBeenCalledTimes(2);
      expect(exactCore).toHaveBeenCalledTimes(2);
    });

    it("should invoke core pipes only after plugin pipes are resolved", async () => {
      const wait = (...args: unknown[]) => {
        const callback = args[args.length - 1] as (error: unknown) => void;

        setTimeout(() => callback(null), 50);
      };
      const exactPlugin1 = vi.fn(wait);
      const exactPlugin2 = vi.fn(wait);
      const exactPlugin3 = vi.fn(wait);
      const exactCore = vi.fn(async () => undefined);

      emitter.onPipe("foo:bar", exactCore);
      emitter.registerPluginPipe("foo:bar", exactPlugin1);
      emitter.registerPluginPipe("foo:bar", exactPlugin2);
      emitter.registerPluginPipe("foo:bar", exactPlugin3);

      await emitter.pipe("foo:bar");

      expect(exactPlugin1).toHaveBeenCalledOnce();
      expect(exactPlugin2).toHaveBeenCalledOnce();
      expect(exactPlugin3).toHaveBeenCalledOnce();
      expect(exactCore).toHaveBeenCalledOnce();

      /* vitest has no `calledAfter`: invocation order is what the mock's
       * `invocationCallOrder` records, and comparing the first (and only)
       * call of each is the same assertion. */
      const [core] = exactCore.mock.invocationCallOrder;
      for (const plugin of [exactPlugin1, exactPlugin2, exactPlugin3]) {
        const [called] = plugin.mock.invocationCallOrder;

        expect(core).toBeGreaterThan(called as number);
      }
    });

    it("should not invoke core pipes if a plugin pipe throws an exception", async () => {
      const pluginPipe = vi.fn(() => {
        throw new Error("oh noes");
      });
      const corePipe = vi.fn(async () => undefined);

      emitter.onPipe("foo:bar", corePipe);
      emitter.registerPluginPipe("foo:bar", pluginPipe);

      /* Whatever a plugin pipe throws reaches the caller as a
       * PluginImplementationError — `pipeRunner` is what wraps it. */
      await expect(emitter.pipe("foo:bar")).rejects.toMatchObject({
        id: "plugin.runtime.unexpected_error",
      });

      expect(pluginPipe).toHaveBeenCalledOnce();
      expect(corePipe).not.toHaveBeenCalled();
    });
  });

  describe("#ask", () => {
    it.each([{}, [], null, undefined, 123, false, true, "foo"])(
      "should throw if a non-function answerer is submitted (%s)",
      (fn) => {
        expect(() =>
          emitter.onAsk("foo:bar", invalid<() => unknown>(fn)),
        ).toThrow(
          `Cannot listen to ask event "foo:bar": "${fn}" is not a function`,
        );
      },
    );

    it("should throw if an answerer has already been registered on the same event", () => {
      emitter.onAsk("foo:bar", vi.fn());

      expect(() => emitter.onAsk("foo:bar", vi.fn())).toThrow(
        'Cannot add a listener to the ask event "foo:bar": event has already an answerer',
      );
    });

    it("should reject if no answerer listens to an event", async () => {
      const rejection = emitter.ask("foo:bar");

      await expect(rejection).rejects.toBeInstanceOf(KuzzleInternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.fatal.assertion_failed",
      });
    });

    it("should resolve to the answerer result when one is registered", async () => {
      const answerer = vi.fn(async () => "foobar");

      emitter.onAsk("foo:bar", answerer);

      await expect(emitter.ask("foo:bar", "foo", "bar")).resolves.toBe(
        "foobar",
      );
      expect(answerer).toHaveBeenCalledWith("foo", "bar");
    });

    it("should trigger wildcarded hooks on ask events", async () => {
      const answerer = vi.fn(async () => "oh noes");
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      emitter.onAsk("foo:bar", answerer);
      emitter.on("foo:bar", listener1);
      emitter.on("foo:bar", listener2);
      emitter.on("foo:*", listener3);

      await expect(emitter.ask("foo:bar", "foo", "bar")).resolves.toBe(
        "oh noes",
      );

      const eventPayload = { args: ["foo", "bar"], response: "oh noes" };

      expect(answerer).toHaveBeenCalledOnce();
      expect(answerer).toHaveBeenCalledWith("foo", "bar");
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener1).toHaveBeenCalledWith(eventPayload);
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledWith(eventPayload);
      expect(listener3).toHaveBeenCalledOnce();
      expect(listener3).toHaveBeenCalledWith(eventPayload);
    });
  });

  describe("#call", () => {
    it.each([{}, [], null, undefined, 123, false, true, "foo"])(
      "should throw if a non-function answerer is submitted (%s)",
      (fn) => {
        expect(() =>
          emitter.onCall("foo:bar", invalid<() => unknown>(fn)),
        ).toThrow(
          `Cannot register callback for event "foo:bar": "${fn}" is not a function`,
        );
      },
    );

    it("should throw if an answerer has already been registered on the same event", () => {
      emitter.onCall("foo:bar", vi.fn());

      expect(() => emitter.onCall("foo:bar", vi.fn())).toThrow(
        'Cannot register callback for event "foo:bar": a callback has already been registered',
      );
    });

    it("should throw if no answerer listens to an event", () => {
      expect(() => emitter.call("foo:bar")).toThrow(KuzzleInternalError);
      expect(() => emitter.call("foo:bar")).toThrow(
        expect.objectContaining({ id: "core.fatal.assertion_failed" }),
      );
    });

    it("should resolve to the answerer result when one is registered", () => {
      const answerer = vi.fn(() => "foobar");

      emitter.onCall("foo:bar", answerer);

      expect(emitter.call("foo:bar", "foo", "bar")).toBe("foobar");
      expect(answerer).toHaveBeenCalledWith("foo", "bar");
    });

    it("should trigger wildcarded hooks on call events", () => {
      const answerer = vi.fn(() => "oh noes");
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      emitter.onCall("foo:bar", answerer);
      emitter.on("foo:bar", listener1);
      emitter.on("foo:bar", listener2);
      emitter.on("foo:*", listener3);

      expect(emitter.call("foo:bar", "foo", "bar")).toBe("oh noes");

      const eventPayload = { args: ["foo", "bar"], response: "oh noes" };

      expect(answerer).toHaveBeenCalledOnce();
      expect(answerer).toHaveBeenCalledWith("foo", "bar");
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener1).toHaveBeenCalledWith(eventPayload);
      expect(listener2).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledWith(eventPayload);
      expect(listener3).toHaveBeenCalledOnce();
      expect(listener3).toHaveBeenCalledWith(eventPayload);
    });
  });

  describe("#registerPluginPipe", () => {
    it("should register the pipe handler under an id of its own", async () => {
      const handler = yields();

      const pipeId = emitter.registerPluginPipe("event", handler);

      expect(pipeId).toBeTypeOf("string");
      /*
       * The Mocha spec read `pluginPipes` and `pluginPipeDefinitions` off the
       * emitter; both are private, and what they were read for is that the
       * handler now runs on that event — which the public surface states.
       */
      await emitter.pipe("event", "payload");

      expect(handler).toHaveBeenCalledOnce();
      expect(payloadOf(handler)).toEqual(["payload"]);
    });
  });

  describe("#unregisterPluginPipe", () => {
    it("should unregister the pipe handler", async () => {
      const handler = yields();
      const pipeId = emitter.registerPluginPipe("event", handler);

      emitter.unregisterPluginPipe(pipeId);

      await emitter.pipe("event", "payload");

      expect(handler).not.toHaveBeenCalled();
      // And the id is gone with it: unregistering twice is unknown_pipe.
      expect(() => emitter.unregisterPluginPipe(pipeId)).toThrow(
        expect.objectContaining({ id: "plugin.runtime.unknown_pipe" }),
      );
    });

    it("should throw an error if the pipeId does not exist", () => {
      expect(() => emitter.unregisterPluginPipe("unknown-pipe-id")).toThrow(
        expect.objectContaining({ id: "plugin.runtime.unknown_pipe" }),
      );
    });
  });
});
