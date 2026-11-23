import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #3087: `node` run as PID 1 (a container without an init) ignored a SIGTERM
 * received while Kuzzle loaded, as the kernel drops a signal that has no
 * handler for PID 1. The handlers armed on import end the process instead.
 *
 * The real listeners are used, and put back as they were after each test.
 */
const SIGNALS = ["SIGINT", "SIGTERM"] as const;

type EarlySignals = typeof import("../../lib/kuzzle/earlySignals");

describe("#kuzzle/earlySignals", () => {
  let saved: Map<string, ((...args: unknown[]) => void)[]>;
  let exit: ReturnType<typeof vi.spyOn>;

  const load = async (): Promise<EarlySignals> => {
    vi.resetModules();

    return import("../../lib/kuzzle/earlySignals");
  };

  beforeEach(() => {
    saved = new Map(
      SIGNALS.map((signal) => [
        signal,
        process.listeners(signal) as ((...args: unknown[]) => void)[],
      ]),
    );

    for (const signal of SIGNALS) {
      process.removeAllListeners(signal);
    }

    globalThis.kuzzleEarlySignalHandlers = undefined;

    exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.kuzzleEarlySignalHandlers = undefined;

    for (const [signal, listeners] of saved) {
      process.removeAllListeners(signal);

      for (const listener of listeners) {
        process.on(signal, listener);
      }
    }
  });

  it("listens to SIGINT and SIGTERM once imported", async () => {
    await load();

    expect(process.listenerCount("SIGINT")).toBe(1);
    expect(process.listenerCount("SIGTERM")).toBe(1);
  });

  it.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const)("exits at once on %s, with code %i", async (signal, code) => {
    await load();

    process.emit(signal, signal);

    expect(exit).toHaveBeenCalledExactlyOnceWith(code);
    expect(process.stderr.write).toHaveBeenCalledWith(
      `Caught signal ${signal} before Kuzzle started: exiting now\n`,
    );
  });

  it("steps aside when something else listens to the signal", async () => {
    await load();
    const own = vi.fn();
    process.on("SIGTERM", own);

    process.emit("SIGTERM", "SIGTERM");

    expect(own).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it("registers its handlers once, even from two copies of the module", async () => {
    const first = await load();
    first.armEarlySignalHandlers();
    await load();

    expect(process.listenerCount("SIGINT")).toBe(1);
    expect(process.listenerCount("SIGTERM")).toBe(1);
  });

  it("removes its handlers once disarmed, from any copy of the module", async () => {
    await load();
    const other = await load();
    const graceful = vi.fn();
    process.on("SIGTERM", graceful);

    other.disarmEarlySignalHandlers();

    expect(process.listenerCount("SIGINT")).toBe(0);
    expect(process.listeners("SIGTERM")).toEqual([graceful]);

    // Twice: nothing left to remove
    other.disarmEarlySignalHandlers();
    expect(process.listeners("SIGTERM")).toEqual([graceful]);
  });

  it("can be armed again once disarmed", async () => {
    const early = await load();

    early.disarmEarlySignalHandlers();
    early.armEarlySignalHandlers();

    expect(process.listenerCount("SIGTERM")).toBe(1);
  });
});
