import type { JSONObject } from "kuzzle-sdk";

// A default import, not `import Redis = require(...)`: the latter emits a real
// `require()` that vite cannot resolve for a `.ts` path, so any vitest spec
// reaching this module dies on "Cannot find module". It type-checks against
// `export =` under `esModuleInterop`. See ADR-0001, TD-49 (#2739).
import Redis from "../../service/cache/redis";

/**
 * `redis.ts` uses `export =`, so it cannot also export this type. Deriving it
 * from the constructor keeps it tied to the real signature instead of to a copy
 * that can drift.
 */
type RedisServiceConfig = ConstructorParameters<typeof Redis>[0];

/**
 * What `idCardHandler.createIdCard()` sends this worker with `action: "start"`.
 * It is a `child_process.fork()` child, so everything here crossed an IPC
 * boundary and is plain JSON.
 */
export type IDCardRenewerConfig = {
  nodeIdKey: string;
  refreshDelay?: number;
  refreshMultiplier: number;
  redis?: {
    config: RedisServiceConfig;
    name: string;
  };
};

/**
 * The two commands this worker issues, and nothing else. A real `Redis` service
 * satisfies it structurally; declaring the whole service here would make every
 * test double carry twenty-odd members it never uses, and would hide a widening
 * of what the worker touches.
 */
type IdCardStore = {
  commands: {
    pexpire(key: string, ttl: number): Promise<number>;
    del(key: string): Promise<unknown>;
  };
};

class IDCardRenewer {
  public redis: IdCardStore | null = null;

  public refreshTimer: NodeJS.Timeout | null = null;

  public nodeIdKey: string | null = null;

  public refreshDelay = 2000;

  public refreshMultiplier: number;

  /** Disposed until `init()` says otherwise. */
  public disposed = true;

  async init(config: IDCardRenewerConfig): Promise<void> {
    if (!this.disposed) {
      return; // Already initialized
    }

    this.disposed = false;
    this.nodeIdKey = config.nodeIdKey;
    this.refreshDelay = config.refreshDelay || 2000;
    this.refreshMultiplier = config.refreshMultiplier;

    /**
     * Since we do not have access to the Kuzzle Context we can't use kuzzle.ask('core:cache:internal:*',...),
     * so we need to have an instance of Redis similar to the one used in the Cache Engine
     */
    try {
      // `redis` is absent when the worker is started without one (the specs do
      // it, and `initRedis` is then expected to reject) — the JS spelled this
      // `config.redis || {}` and read two undefined fields off it.
      const redisConf = config.redis;
      await this.initRedis(redisConf?.config, redisConf?.name);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `Failed to connect to redis, could not refresh ID card: ${error.message}`,
      );
      // `process.send`, not `this.parentPort.postMessage`: this worker is a
      // `child_process.fork()` child and has no `parentPort` — that is the
      // `worker_threads` API, left behind by an earlier implementation, and the
      // property was never assigned anywhere. The one path that exists to say
      // *why* the ID card cannot be renewed used to raise a TypeError instead
      // of sending `{ error }`, so the node was evicted by the `close` handler
      // with a generic reason rather than this one. See TD-63 (#2770).
      process.send({
        error: `Failed to connect to redis, could not refresh ID card: ${error.message}`,
      });
      return;
    }

    /**
     * Early renew, otherwise we need to wait the refreshDelay before the first ID Card renewal
     * which could be enough to make the ID Card expire.
     */
    await this.renewIDCard();
    if (!this.disposed) {
      this.refreshTimer = setInterval(
        this.renewIDCard.bind(this),
        this.refreshDelay,
      );
    }

    // Notify that the worker is running and updating the ID Card
    process.send({ initialized: true });
  }

  async initRedis(config: RedisServiceConfig, name: string): Promise<void> {
    const redis = new Redis(config, name);
    await redis.init();
    this.redis = redis;
  }

  async renewIDCard(): Promise<void> {
    if (this.disposed) {
      return; // Do not refresh ID Card when worker has been disposed
    }

    try {
      const refreshed = await this.redis.commands.pexpire(
        this.nodeIdKey,
        this.refreshDelay * this.refreshMultiplier,
      );
      // Unable to refresh the key in time before it expires
      // => this node is too slow, we need to remove it from the cluster
      if (refreshed === 0) {
        await this.dispose();
        process.send({
          error: "Node too slow: ID card expired",
        });
      }
    } catch (error) {
      await this.dispose();
      process.send({
        error: `Failed to refresh ID Card: ${error.message}`,
      });
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return; // Already disposed
    }

    this.disposed = true;

    clearInterval(this.refreshTimer);
    this.refreshTimer = null;

    // If the worker is disposed before it had time to starts, redis service
    // may not have been initialized
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.commands.del(this.nodeIdKey);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        `Could not delete key '${this.nodeIdKey}' from redis: ${error.message}`,
      );
    }
  }
}

const idCardRenewer = new IDCardRenewer();

process.on("message", async (message: JSONObject) => {
  if (message.action === "start") {
    // Simulate basic global Kuzzle Context
    global.kuzzle = { ...message.kuzzle };

    // A deliberately partial logger: this process is a `fork()` child with no
    // Kuzzle instance, and the four console methods are all it needs. The
    // codebase already knows — `redis.ts` branches on `global.kuzzle.log.child`
    // being absent for exactly this case — but the type does not: `log` is
    // declared `Logger`. Assigned through `Object.assign` rather than asserted
    // with a cast, and reported rather than silenced: making the declaration
    // admit a partial logger is a change to a widely-shared type, not part of
    // a conversion.
    Object.assign(global.kuzzle, {
      log: {
        debug: console.debug, // eslint-disable-line no-console
        error: console.error, // eslint-disable-line no-console
        info: console.info, // eslint-disable-line no-console
        warn: console.warn, // eslint-disable-line no-console
      },
    });
    // Should never throw
    // Named field by field rather than passed whole: this crossed an IPC
    // boundary as plain JSON, and listing what is read is what keeps the
    // worker's contract with `idCardHandler.createIdCard()` visible.
    await idCardRenewer.init({
      nodeIdKey: message.nodeIdKey,
      redis: message.redis,
      refreshDelay: message.refreshDelay,
      refreshMultiplier: message.refreshMultiplier,
    });
  } else if (message.action === "dispose") {
    // Should never throw
    await idCardRenewer.dispose();
    process.exit(0);
  }
});

// When the IPC is closed on the main process side
process.on("disconnect", async () => {
  await idCardRenewer.dispose();
  process.exit();
});

export { IDCardRenewer };
