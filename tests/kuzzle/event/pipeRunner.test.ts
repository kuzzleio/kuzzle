import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import { ServiceUnavailableError } from "../../../lib/kerror/errors/serviceUnavailableError";
import PipeRunner from "../../../lib/kuzzle/event/pipeRunner";
import { invalid } from "../../helpers/invalid";

/**
 * A one-step chain that hands its callback back to the test instead of calling
 * it, so a test decides when — and whether — the pipe finishes.
 */
class RemoteControlledPipe {
  private _callback: ((error?: unknown, ...results: unknown[]) => void) | null =
    null;

  readonly chain = [
    (...args: unknown[]) => {
      this._callback = args.pop() as (error?: unknown) => void;
    },
  ];

  /** The callback the chain was given, or `null` if it was never run. */
  get pending() {
    return this._callback;
  }

  private get callback() {
    if (this._callback === null) {
      throw new Error("the pipe has not been run");
    }

    return this._callback;
  }

  resolve(...data: unknown[]) {
    this.callback(null, ...data);
  }

  reject(error: unknown) {
    this.callback(error);
  }
}

describe("#kuzzle/event/PipeRunner", () => {
  const maxConcurrentPipes = 50;
  const bufferSize = 50000;

  let pipeRunner: PipeRunner;
  let pipe: RemoteControlledPipe;

  beforeEach(() => {
    pipeRunner = new PipeRunner(maxConcurrentPipes, bufferSize);
    pipe = new RemoteControlledPipe();

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("#constructor", () => {
    it("should throw if an invalid number of max concurrent pipes is provided", () => {
      for (const value of [-1, [], {}, 0, null, undefined, "URGH"]) {
        expect(() => new PipeRunner(invalid<number>(value), 123)).toThrow(
          "Cannot instantiate pipes executor: invalid maxConcurrentPipes parameter value",
        );
      }
    });

    it("should throw if an invalid buffer size is provided", () => {
      for (const value of [-1, [], {}, 0, null, undefined, "URGH"]) {
        expect(() => new PipeRunner(123, invalid<number>(value))).toThrow(
          "Cannot instantiate pipes executor: invalid pipesBufferSize parameter value",
        );
      }
    });
  });

  describe("#run", () => {
    it("should run a pipe immediately if there is space", () => {
      const callback = vi.fn();

      expect(pipeRunner.running).toBe(0);

      pipeRunner.run(pipe.chain, ["bar"], callback, undefined);

      expect(pipeRunner.running).toBe(1);
      expect(pipeRunner.buffer.length).toBe(0);

      pipe.resolve("foo");
      vi.runAllTimers();

      expect(pipeRunner.running).toBe(0);
      /*
       * The Mocha spec asserted from inside this callback, so it asserted
       * nothing at all if the callback never fired — the failure mode the
       * `settle` helper exists for. Here the callback is a spy and the
       * assertion is outside it.
       */
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(null, "foo");
    });

    it("should forward a KuzzleError unchanged", () => {
      const error = new BadRequestError("oh noes");
      const callback = vi.fn();

      pipeRunner.run(pipe.chain, ["bar"], callback, undefined);

      expect(pipeRunner.running).toBe(1);
      expect(pipeRunner.buffer.length).toBe(0);

      pipe.reject(error);
      vi.runAllTimers();

      expect(pipeRunner.running).toBe(0);
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(error);
    });

    it("should return an unexpected error if a non-kuzzle error is returned", () => {
      const error = new Error("oh noes");
      const callback = vi.fn();

      pipeRunner.run(pipe.chain, ["bar"], callback, undefined);

      expect(pipeRunner.running).toBe(1);
      expect(pipeRunner.buffer.length).toBe(0);

      pipe.reject(error);
      vi.runAllTimers();

      expect(pipeRunner.running).toBe(0);
      expect(callback).toHaveBeenCalledOnce();

      const [forwarded] = callback.mock.calls[0] as [PluginImplementationError];

      expect(forwarded).toBeInstanceOf(PluginImplementationError);
      expect(forwarded.message).toContain(error.message);
      expect(forwarded.id).toBe("plugin.runtime.unexpected_error");
    });

    /**
     * A pipe rejecting with a non-Error: the message is the value's own
     * `message`, as in v2.56.0, and "undefined" when it has none.
     */
    it.each([
      ["an object with a message", { message: "oh noes" }, "oh noes"],
      ["a string", "oh noes", "undefined"],
    ])(
      "should use the message of %s a pipe rejected with",
      (_name, rejected, placeholder) => {
        const callback = vi.fn();

        pipeRunner.run(pipe.chain, ["bar"], callback, undefined);
        pipe.reject(rejected);
        vi.runAllTimers();

        const [forwarded] = callback.mock.calls[0] as [
          PluginImplementationError,
        ];

        expect(forwarded).toBeInstanceOf(PluginImplementationError);
        expect(forwarded.id).toBe("plugin.runtime.unexpected_error");
        expect(forwarded.message).toBe(
          `Caught an unexpected plugin error: ${placeholder}`,
        );
      },
    );

    it("should bufferize and replay pipes if there are no more slots available", () => {
      const callback = vi.fn();

      pipeRunner.running = maxConcurrentPipes - 1;
      expect(pipeRunner.buffer.length).toBe(0);

      pipeRunner.run(pipe.chain, ["bar"], callback, {});

      expect(pipeRunner.running).toBe(maxConcurrentPipes);
      expect(pipeRunner.buffer.length).toBe(0);

      const buffered = new RemoteControlledPipe();

      pipeRunner.run(buffered.chain, ["qux"], callback, {});

      expect(pipeRunner.running).toBe(maxConcurrentPipes);
      expect(pipeRunner.buffer.length).toBe(1);
      // Nothing has run the buffered chain: it is waiting for a slot.
      expect(buffered.pending).toBeNull();

      vi.runAllTimers();

      pipe.resolve("foo");
      vi.runAllTimers();

      expect(pipeRunner.running).toBe(maxConcurrentPipes);
      expect(pipeRunner.buffer.length).toBe(0);

      buffered.resolve("foo");
      vi.runAllTimers();

      expect(pipeRunner.running).toBe(maxConcurrentPipes - 1);
      expect(pipeRunner.buffer.length).toBe(0);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, null, "foo");
      expect(callback).toHaveBeenNthCalledWith(2, null, "foo");
    });

    it("should reject the callback immediately if there is no room left in the buffer", () => {
      /*
       * A runner of one slot and a buffer of one, filled — rather than the
       * Mocha spec's `pipeRunner.buffer = { length: bufferSize }`, which
       * replaced the Denque with an object that only looked full. The
       * condition under test is the real buffer's.
       */
      const runner = new PipeRunner(1, 1);
      const callback = vi.fn();

      runner.running = 1;
      runner.run(new RemoteControlledPipe().chain, ["bar"], vi.fn(), {});
      expect(runner.buffer.length).toBe(1);

      runner.run(pipe.chain, ["bar"], callback, {});

      expect(callback).toHaveBeenCalledOnce();

      const [error] = callback.mock.calls[0] as [ServiceUnavailableError];

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.id).toBe("plugin.runtime.too_many_pipes");
      // The discarded chain was never run.
      expect(pipe.pending).toBeNull();
      expect(runner.buffer.length).toBe(1);
    });
  });

  describe("#_runNext", () => {
    /** Fills the buffer with `count` chains, by leaving no slot free. */
    function fillBuffer(count: number) {
      const chains = Array.from({ length: count }, () => ({
        chain: new RemoteControlledPipe().chain,
        args: ["bar"],
        callback: vi.fn(),
        context: {},
      }));

      pipeRunner.running = maxConcurrentPipes;

      for (const { chain, args, callback, context } of chains) {
        pipeRunner.run(chain, args, callback, context);
      }

      return chains;
    }

    it("should resubmit the first item of the buffer", () => {
      const [first] = fillBuffer(3);

      pipeRunner.running = 0;
      const run = vi.spyOn(pipeRunner, "run").mockImplementation(() => {});

      pipeRunner._runNext();

      expect(pipeRunner.buffer.length).toBe(2);
      expect(run).toHaveBeenCalledOnce();
      expect(run).toHaveBeenCalledWith(
        first.chain,
        first.args,
        first.callback,
        first.context,
      );
    });

    it("should skip if the buffer is empty", () => {
      const run = vi.spyOn(pipeRunner, "run").mockImplementation(() => {});

      pipeRunner._runNext();

      expect(pipeRunner.buffer.length).toBe(0);
      expect(run).not.toHaveBeenCalled();
    });

    it("should skip if there are already too many pipes running", () => {
      fillBuffer(3);

      const run = vi.spyOn(pipeRunner, "run").mockImplementation(() => {});

      pipeRunner._runNext();

      expect(pipeRunner.buffer.length).toBe(3);
      expect(run).not.toHaveBeenCalled();
    });
  });
});
