import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Bluebird from "bluebird";
import stableStringify from "json-stable-stringify";

import Kuzzle from "../../lib/kuzzle/kuzzle";
import type { StartOptions } from "../../lib/types/Kuzzle";
import Plugin from "../../lib/core/plugin/plugin";
import kuzzleStateEnum from "../../lib/kuzzle/kuzzleStateEnum";
import { loadConfig } from "../../lib/config";
import { sha256 } from "../../lib/util/crypto";
import { invalid } from "../helpers/invalid";
import { lastMutex, resetMutexes } from "./kuzzleFixture";
import { present } from "../helpers/present";

/**
 * ⚠️ The Mocha spec rewired `koncorde_1` and `vault_1` — **the variable names
 * `tsc` emits for two of this module's imports**. That is the plainest case in
 * the suite of a test written against compiled output rather than against the
 * subject, and it is why that spec could only ever run out of `dist/test`.
 * `vi.mock` names the dependency instead, so this port is *simpler* than what
 * it replaces.
 */
vi.mock("koncorde", async () => {
  const { Koncorde } = await import("./kuzzleFixture");

  return { Koncorde };
});

vi.mock("../../lib/kuzzle/vault", async () => {
  const { vault } = await import("./kuzzleFixture");

  return { default: vault };
});

vi.mock("../../lib/util/mutex", async () => {
  const { MutexStub } = await import("./kuzzleFixture");

  return { Mutex: MutexStub };
});

/** The five modules `start()` constructs and initialises, in place. */
vi.mock("../../lib/core/cache/cacheEngine", async () => {
  const { moduleStub } = await import("./kuzzleFixture");

  return { default: moduleStub("cacheEngine") };
});

vi.mock("../../lib/core/storage/storageEngine", async () => {
  const { moduleStub } = await import("./kuzzleFixture");

  return { default: moduleStub("storageEngine") };
});

vi.mock("../../lib/core/realtime", async () => {
  const { moduleStub } = await import("./kuzzleFixture");

  return { default: moduleStub("realtime") };
});

vi.mock("../../lib/core/security", async () => {
  const { moduleStub } = await import("./kuzzleFixture");

  return { default: moduleStub("security") };
});

vi.mock("../../lib/cluster", async () => {
  const { moduleStub } = await import("./kuzzleFixture");

  return { default: moduleStub("cluster") };
});

type Internals = {
  _waitForImportToFinish: () => Promise<unknown>;
  persistHashedImport: (payload: Record<string, unknown>) => Promise<void>;
};

/** `funnel.remainingRequests` is a getter on the real funnel. */
const funnelOf = (kuzzle: Kuzzle) =>
  invalid<{ remainingRequests: number }>(kuzzle.funnel);

const internalsOf = (kuzzle: Kuzzle) => invalid<Internals>(kuzzle);

/**
 * `json-stable-stringify` answers `undefined` for a value with no JSON form —
 * `undefined` itself, a function — which none of the payloads below are. The
 * subject hashes the same way, so saying it here keeps the expectations
 * readable and fails on this line if a payload ever stops being serializable.
 */
function stable(value: unknown): string {
  const json = stableStringify(value);

  present(json, "the stable stringification");

  return json;
}

describe("#kuzzle/Kuzzle", () => {
  let kuzzle: Kuzzle;
  let application: Plugin;
  let config: ReturnType<typeof loadConfig>;
  /** Every initialisation the fixture observes, in the order it happened. */
  let order: string[];
  let ask: ReturnType<typeof vi.fn>;
  let answers: Map<string, unknown>;
  let moduleInits: Map<string, ReturnType<typeof vi.fn>>;

  /**
   * A fresh Kuzzle, with every collaborator the tests drive replaced.
   *
   * ⚠️ `global.kuzzle` is an accessor whose setter throws on a second write
   * (`lib/kuzzle/kuzzle.ts` installs it at module evaluation). Deleting the
   * property turns the constructor's `global.kuzzle = this` into a plain
   * assignment, which is what lets a spec build more than one instance —
   * the same trick the Mocha spec used, stated here rather than buried in a
   * helper called `_mockKuzzle`.
   */
  const buildKuzzle = (): Kuzzle => {
    Reflect.deleteProperty(global, "kuzzle");

    const built = new Kuzzle(config);
    const track =
      (name: string) =>
      async (...args: unknown[]) => {
        order.push(args[0] === undefined ? name : `${name}:${args[0]}`);

        return undefined;
      };

    Object.assign(built, {
      adminController: { init: vi.fn() },
      ask,
      debugger: { init: vi.fn(async () => undefined) },
      dumpGenerator: { dump: vi.fn(async () => "/tmp/dump") },
      emit: vi.fn(track("emit")),
      entryPoint: {
        dispatch: vi.fn(),
        init: vi.fn(track("entryPoint.init")),
        startListening: vi.fn(track("entryPoint.startListening")),
      },
      funnel: {
        init: vi.fn(track("funnel.init")),
        remainingRequests: 0,
      },
      internalIndex: {
        init: vi.fn(track("internalIndex.init")),
        refreshCollection: vi.fn(async () => undefined),
        updateMapping: vi.fn(async () => undefined),
      },
      log: {
        error: vi.fn(),
        flush: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      pipe: vi.fn(track("pipe")),
      pluginsManager: {
        application: undefined,
        init: vi.fn(track("pluginsManager.init")),
        routes: [],
      },
      router: { init: vi.fn(track("router.init")) },
      statistics: { init: vi.fn(track("statistics.init")) },
      tokenManager: { init: vi.fn(track("tokenManager.init")) },
      validation: {
        curateSpecification: vi.fn(track("validation.curateSpecification")),
        init: vi.fn(track("validation.init")),
      },
    });

    return built;
  };

  beforeEach(async () => {
    const fixture = await import("./kuzzleFixture");

    fixture.reset();
    resetMutexes();

    order = [];
    answers = new Map();
    moduleInits = fixture.moduleInits;

    ask = vi.fn(async (event: string, ...args: unknown[]) => {
      order.push(`ask:${event}`);

      for (const [key, answer] of answers) {
        if (`${event}:${args.join(":")}`.startsWith(key)) {
          return answer;
        }
      }

      return undefined;
    });

    /* `loadConfig()` answers a shared object. */
    config = JSON.parse(JSON.stringify(loadConfig()));

    kuzzle = buildKuzzle();

    application = new Plugin(invalid({ init: vi.fn() }), {
      application: true,
      name: "application",
    });
    application.openApi = invalid("openApi");
  });

  afterEach(() => {
    Reflect.deleteProperty(global, "kuzzle");
    vi.restoreAllMocks();
  });

  it("should emit and listen to its own events", async () => {
    const heard = new Promise<void>((resolve) => {
      /* The emitter is the real one: `emit` above is the stub the start
       * sequence is asserted through, so this test uses a fresh instance. */
      const emitter = buildKuzzle();

      Object.assign(emitter, { emit: Kuzzle.prototype.emit });
      emitter.on("event", () => resolve());
      emitter.emit("event");
    });

    await expect(heard).resolves.toBeUndefined();
  });

  describe("#start", () => {
    beforeEach(() => {
      internalsOf(kuzzle)._waitForImportToFinish = async () => undefined;
      kuzzle.install = vi.fn(async () => undefined);
      kuzzle.loadInitialState = vi.fn(async () => undefined);
    });

    it("should initialise every component in order", async () => {
      expect(kuzzle.state).toBe(kuzzleStateEnum.STARTING);

      await kuzzle.start(
        application,
        invalid({
          import: { something: "here" },
          installations: [{ handler: () => {}, id: "foo" }],
          support: { something: "here" },
        }),
      );

      expect(order).toEqual([
        "pipe:kuzzle:state:start",
        "internalIndex.init",
        "validation.init",
        "tokenManager.init",
        "funnel.init",
        "statistics.init",
        "validation.curateSpecification",
        "entryPoint.init",
        "pluginsManager.init",
        "ask:core:security:verify",
        "router.init",
        "pipe:kuzzle:start",
        "pipe:kuzzle:state:live",
        "entryPoint.startListening",
        "pipe:kuzzle:state:ready",
        "emit:core:kuzzleStart",
      ]);

      expect(kuzzle.state).toBe(kuzzleStateEnum.RUNNING);
    });

    it("should hand the start options to what consumes them", async () => {
      const options = invalid<StartOptions>({
        import: { something: "here" },
        installations: [{ handler: () => {}, id: "foo" }],
        support: { something: "else" },
      });

      await kuzzle.start(application, options);

      expect(kuzzle.loadInitialState).toHaveBeenCalledWith(
        expect.objectContaining(options.import),
        options.support,
      );
      expect(kuzzle.install).toHaveBeenCalledWith(options.installations);
      expect(kuzzle.pluginsManager.application).toBe(application);
    });

    // @deprecated
    it("should build Koncorde with the configured regexp engine", async () => {
      const { Koncorde } = await import("./kuzzleFixture");

      await kuzzle.start(application);

      expect(Koncorde).toHaveBeenCalledWith(
        expect.objectContaining({ regExpEngine: "re2" }),
      );

      const withPcre = buildKuzzle();

      internalsOf(withPcre)._waitForImportToFinish = async () => undefined;
      withPcre.install = vi.fn(async () => undefined);
      withPcre.loadInitialState = vi.fn(async () => undefined);
      withPcre.config.realtime.pcreSupport = true;

      await withPcre.start(application);

      expect(Koncorde).toHaveBeenLastCalledWith(
        expect.objectContaining({ regExpEngine: "js" }),
      );
    });

    it("should load the vault with the options it was given", async () => {
      const { vault } = await import("./kuzzleFixture");

      await kuzzle.start(application, {
        secretsFile: "/secrets.json",
        vaultKey: "the-key",
      });

      expect(vault.load).toHaveBeenCalledWith(
        "the-key",
        "/secrets.json",
        config.vault?.newAlgorithm,
      );
    });

    it("should register the process handlers it needs", async () => {
      const on = vi.spyOn(process, "on").mockReturnValue(process);
      const removeAllListeners = vi
        .spyOn(process, "removeAllListeners")
        .mockReturnValue(process);

      await kuzzle.start(application);

      /* Each signal is cleared of whatever held it before Kuzzle takes it —
       * the Mocha spec asserted the two lists interleaved, call by call,
       * which said the same thing at ten times the length. */
      const signals = [
        "unhandledRejection",
        "uncaughtException",
        "SIGQUIT",
        "SIGABRT",
        "SIGTRAP",
        "SIGINT",
        "SIGTERM",
      ];

      for (const signal of signals) {
        expect(removeAllListeners).toHaveBeenCalledWith(signal);
        expect(on).toHaveBeenCalledWith(signal, expect.any(Function));
      }

      expect(on).toHaveBeenCalledWith("exit", expect.any(Function));
    });

    it("should not initialise the cluster when it is disabled", async () => {
      kuzzle.config.cluster.enabled = false;

      await kuzzle.start(application, {});

      expect(moduleInits.get("cluster")).not.toHaveBeenCalled();
    });

    it("should initialise the cluster when it is enabled", async () => {
      kuzzle.config.cluster.enabled = true;

      await kuzzle.start(application, {});

      expect(moduleInits.get("cluster")).toHaveBeenCalled();
    });
  });

  describe("#dump", () => {
    it("should delegate to the dump generator", async () => {
      await kuzzle.dump("a-suffix");

      expect(
        invalid<{ dumpGenerator: { dump: ReturnType<typeof vi.fn> } }>(kuzzle)
          .dumpGenerator.dump,
      ).toHaveBeenCalledExactlyOnceWith("a-suffix");
    });
  });

  describe("#shutdown", () => {
    let exit: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exit = vi.spyOn(process, "exit").mockImplementation(() => {
        return undefined as never;
      });
    });

    it("should wait until the funnel has no request left", async () => {
      /* Fake timers do not work with the async function under test, so the
       * delay is replaced with a real, short one. */
      const delay = vi
        .spyOn(Bluebird, "delay")
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(resolve, 10),
            ) as unknown as Bluebird<void>,
        );

      funnelOf(kuzzle).remainingRequests = 1;
      setTimeout(() => {
        funnelOf(kuzzle).remainingRequests = 0;
      }, 50);

      await kuzzle.shutdown();

      /* ⚠️ `calledWith("shutdown")` again matched a prefix: the subject
       * dispatches `("shutdown", {})`, and the payload was unasserted. */
      expect(kuzzle.entryPoint.dispatch).toHaveBeenCalledExactlyOnceWith(
        "shutdown",
        {},
      );
      expect(order).toContain("pipe:kuzzle:shutdown");
      expect(delay.mock.calls.length).toBeGreaterThan(1);
      // @deprecated
      expect(order).toContain("emit:core:shutdown");
      expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    });

    it("should flush both loggers", async () => {
      const flush = vi.fn(async () => undefined);

      /* `log` lives on the application instance; `pluginsManager.application`
       * is the `Plugin` wrapper around it, and the shutdown used to read
       * `log` off the wrapper, which never has one (TD-51). */
      kuzzle.pluginsManager.application = new Plugin(
        invalid({ init: vi.fn(), log: { flush } }),
        { application: true, name: "application" },
      );
      funnelOf(kuzzle).remainingRequests = 0;

      await kuzzle.shutdown();

      expect(flush).toHaveBeenCalledOnce();
      expect(kuzzle.log.flush).toHaveBeenCalledOnce();
    });
  });

  describe("#install", () => {
    let handler: ReturnType<typeof vi.fn<() => Promise<void>>>;

    beforeEach(() => {
      handler = vi.fn<() => Promise<void>>(async () => undefined);
      vi.spyOn(Date, "now").mockReturnValue(1758585600000);
    });

    it("should run an installation that never ran, and record it", async () => {
      answers.set("core:storage:private:document:exist", false);

      await kuzzle.install([{ description: "description", handler, id: "id" }]);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:private:document:exist",
        "kuzzle",
        "installations",
        "id",
      );
      expect(ask).toHaveBeenCalledWith(
        "core:storage:private:document:create",
        "kuzzle",
        "installations",
        {
          description: "description",
          handler: handler.toString(),
          installedAt: Date.now(),
        },
        { id: "id" },
      );
      expect(handler).toHaveBeenCalledOnce();
      expect(kuzzle.log.info).toHaveBeenCalledOnce();
    });

    it("should skip an installation that already ran", async () => {
      answers.set("core:storage:private:document:exist", true);

      await kuzzle.install([{ handler, id: "id" }]);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:private:document:exist",
        "kuzzle",
        "installations",
        "id",
      );
      expect(ask).not.toHaveBeenCalledWith(
        "core:storage:private:document:create",
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(handler).not.toHaveBeenCalled();
      expect(kuzzle.log.info).not.toHaveBeenCalled();
    });
  });

  describe("#loadInitialState", () => {
    let toImport: Record<string, unknown>;
    let toSupport: Record<string, unknown>;
    const payload = { something: "here" };

    beforeEach(() => {
      internalsOf(kuzzle)._waitForImportToFinish = async () => undefined;

      toImport = {
        mappings: payload,
        onExistingUsers: "skip",
        profiles: payload,
        roles: payload,
        userMappings: payload,
        users: payload,
      };

      toSupport = {
        fixtures: payload,
        mappings: payload,
        securities: { profiles: payload, roles: payload, user: payload },
      };
    });

    it("should import mappings and permissions, and record their hashes", async () => {
      await kuzzle.loadInitialState(toImport, {});

      expect(ask).toHaveBeenCalledWith(
        "core:cache:internal:store",
        "backend:init:import:mappings",
        sha256(stable({ toImport: { mappings: payload }, toSupport: {} })),
      );
      expect(ask).toHaveBeenCalledWith(
        "core:cache:internal:store",
        "backend:init:import:permissions",
        sha256(
          stable({
            toImport: { profiles: payload, roles: payload, users: payload },
            toSupport: {},
          }),
        ),
      );

      expect(kuzzle.internalIndex.updateMapping).toHaveBeenCalledWith(
        "users",
        payload,
      );
      expect(kuzzle.internalIndex.refreshCollection).toHaveBeenCalledWith(
        "users",
      );
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:mappings:import",
        payload,
        { indexCacheOnly: false, propagate: false, refresh: true },
      );
      expect(ask).toHaveBeenCalledWith(
        "core:security:load",
        { profiles: payload, roles: payload, users: payload },
        {
          onExistingUsers: "skip",
          onExistingUsersWarning: true,
          refresh: "wait_for",
        },
      );
    });

    it("should import support mappings, fixtures and securities", async () => {
      await kuzzle.loadInitialState({}, toSupport);

      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:mappings:import",
        payload,
        {
          indexCacheOnly: false,
          propagate: false,
          rawMappings: true,
          refresh: true,
        },
      );
      expect(ask).toHaveBeenCalledWith(
        "core:storage:public:document:import",
        payload,
      );
      expect(ask).toHaveBeenCalledWith(
        "core:security:load",
        toSupport.securities,
        {
          force: true,
          refresh: "wait_for",
        },
      );
    });

    it.each([
      ["mappings", { mappings: payload }],
      ["permissions", { securities: { roles: payload } }],
    ])(
      "should refuse %s coming from import and support at once",
      async (_name, support) => {
        await expect(
          kuzzle.loadInitialState(
            { mappings: payload, profiles: payload },
            support,
          ),
        ).rejects.toMatchObject({ id: "plugin.runtime.incompatible" });
      },
    );

    describe("bookkeeping", () => {
      beforeEach(() => {
        internalsOf(kuzzle).persistHashedImport = vi.fn<
          (payload: Record<string, unknown>) => Promise<void>
        >(async () => undefined);
      });

      it.each([
        ["neither Redis nor ES holds a hash", null, false],
        ["ES holds a hash and Redis does not", null, true],
        ["Redis holds a hash and ES does not", "123", false],
      ])(
        "should persist the payload hash when %s",
        async (_name, existingRedisHash, existingESHash) => {
          answers.set("core:cache:internal:get", existingRedisHash);
          answers.set("core:storage:private:document:exist", existingESHash);
          answers.set("core:storage:private:document:get", {
            _source: { hash: "123" },
          });

          await kuzzle.loadInitialState(toImport, {});

          expect(
            vi.mocked(internalsOf(kuzzle).persistHashedImport),
          ).toHaveBeenCalledWith({
            existingESHash,
            existingRedisHash,
            importPayloadHash: sha256(
              stable({ toImport: { mappings: payload }, toSupport: {} }),
            ),
            type: "mappings",
          });
        },
      );

      /* TD-69 (#2782): the two reads used to happen before `mutex.lock()`, so
       * the holder decided from a snapshot another node could already have
       * invalidated, and then created a document that existed. */
      it("should read the bookkeeping only after taking the lock", async () => {
        answers.set("core:cache:internal:get", null);
        answers.set("core:storage:private:document:exist", false);

        await kuzzle.loadInitialState(toImport, {});

        const mutex = lastMutex();
        const locked = mutex.lock.mock.invocationCallOrder[0];
        const read = ask.mock.invocationCallOrder.at(-1);

        expect(locked).toBeLessThan(read!);
        expect(order.at(-2)).toBe("ask:core:cache:internal:get");
      });

      /* The lock is held until the `finally`, across every import type and the
       * wait that follows; the 5s default expired under its own holder. */
      it("should hold the lock for longer than the default TTL", async () => {
        await kuzzle.loadInitialState(toImport, {});

        expect(lastMutex().ttl).toBeGreaterThan(5000);
      });
    });

    describe("#persistHashedImport", () => {
      /* The id is fixed, so a conflict means another node initialized the same
       * import — convergence, not an error. `create` made it kill startup. */
      it("should write with createOrReplace", async () => {
        await internalsOf(kuzzle).persistHashedImport({
          existingESHash: false,
          existingRedisHash: null,
          importPayloadHash: "hash",
          type: "mappings",
        });

        expect(ask).toHaveBeenCalledWith(
          "core:storage:private:document:createOrReplace",
          "kuzzle",
          "imports",
          "backend:init:import:mappings",
          { hash: "hash" },
        );
        expect(ask).not.toHaveBeenCalledWith(
          "core:storage:private:document:create",
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        );
      });

      it("should write the cached hash when only Redis holds one", async () => {
        answers.set("core:cache:internal:get", "cached-hash");

        await internalsOf(kuzzle).persistHashedImport({
          existingESHash: false,
          existingRedisHash: "cached-hash",
          importPayloadHash: "hash",
          type: "mappings",
        });

        expect(ask).toHaveBeenCalledWith(
          "core:storage:private:document:createOrReplace",
          "kuzzle",
          "imports",
          "backend:init:import:mappings",
          { hash: "cached-hash" },
        );
      });
    });
  });
});
