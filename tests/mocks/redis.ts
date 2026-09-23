/**
 * A fake `ioredis`, small enough to read.
 *
 * The Mocha spec stubbed `Redis.prototype._buildClient` and
 * `_buildClusterClient` — the subject's two `private` factories — so the
 * client it tested against was never the class the subject builds. That cost
 * it a branch: `searchKeys()` splits on `client instanceof Cluster`, and a
 * stand-in that is not one could never enter the cluster half.
 *
 * Mocking the module instead means the subject builds its client exactly as it
 * does in production, and `instanceof` answers what it answers there.
 */
import EventEmitter from "eventemitter3";
import { vi } from "vitest";

/**
 * The real `getBuiltinCommands()` answers ~200 names, and `setCommands()`
 * wires one dispatcher per name. These are the ones a spec drives; a subject
 * that starts calling another says so by failing here.
 */
export const BUILTIN_COMMANDS = [
  "client",
  "del",
  "get",
  "info",
  "multi",
  "ping",
  "select",
  "set",
] as const;

/** The error the next client built will emit instead of becoming ready. */
let connectionError: Error | null = null;

/** Every client built since the last {@link resetRedisMock}, in order. */
export const built: FakeRedis[] = [];

/** Makes the next client fail to connect, as an unreachable server would. */
export function failNextConnection(error: Error): void {
  connectionError = error;
}

export function resetRedisMock(): void {
  built.length = 0;
  connectionError = null;
}

class FakeRedis extends EventEmitter {
  /** What the subject handed the constructor — the options it composed. */
  public options: Record<string, unknown>;
  public getBuiltinCommands = () => [...BUILTIN_COMMANDS];

  [command: string]: unknown;

  constructor(options: Record<string, unknown> = {}) {
    super();

    this.options = options;

    for (const command of BUILTIN_COMMANDS) {
      this[command] = vi.fn(async () => undefined);
    }

    this.select = vi.fn(async () => undefined);

    built.push(this);

    const error = connectionError;

    connectionError = null;

    /* A connection settles after the caller has had a chance to subscribe —
     * `_initSequence()` registers its `once("ready")` after building. */
    process.nextTick(() =>
      error ? this.emit("error", error) : this.emit("ready"),
    );
  }

  /** The `SCAN` cursor, answering ten keys under the requested prefix. */
  scanStream({ match }: { match?: string } = {}) {
    const stream = new EventEmitter();
    const prefix = match ? match.replaceAll(/[*?]/g, "") : "k";

    setTimeout(() => {
      stream.emit(
        "data",
        Array.from({ length: 10 }, (_, i) => `${prefix}${i}`),
      );
      stream.emit("end", true);
    }, 0);

    return stream;
  }
}

class FakeCluster extends FakeRedis {
  /** `new Cluster(nodes, options)` — the options are the *second* argument. */
  constructor(
    public nodeList: unknown[],
    options: Record<string, unknown> = {},
  ) {
    super(options);
  }

  /** `searchKeys()` scans every master of a cluster. */
  nodes() {
    return [this];
  }
}

export { FakeCluster, FakeRedis };
