import Bluebird from "bluebird";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InternalIndexHandler from "../../lib/kuzzle/internalIndexHandler";
import { InternalError as KuzzleInternalError } from "../../lib/kerror/errors/internalError";
import { invalid } from "../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../mocks/kuzzle";

const INDEX = "%kuzzle";

/**
 * Every mutex the subject and its base class take.
 *
 * ⚠️ Two modules reach for `lib/util/mutex` on this path — the handler, for
 * `InternalIndexBootstrap`, and `Store.init`, for `Store.init(%kuzzle)`. The
 * Mocha spec had to say so twice (`mockrequire` the module, then `reRequire`
 * `core/shared/store` so the base class picked the stub up); `vi.mock`
 * replaces the module for the whole graph, so one declaration covers both.
 * `MutexMock.__getLastMutex()` becomes this list, which says *which* locks
 * were taken rather than only the last one.
 */
const mutexes = vi.hoisted(() => {
  const taken: {
    lock: ReturnType<typeof import("vitest").vi.fn>;
    resource: string;
    unlock: ReturnType<typeof import("vitest").vi.fn>;
    wait: ReturnType<typeof import("vitest").vi.fn>;
  }[] = [];

  return { granted: true, taken };
});

vi.mock("../../lib/util/mutex", () => ({
  Mutex: class {
    public lock = vi.fn(async () => mutexes.granted);
    public unlock = vi.fn(async () => undefined);
    public wait = vi.fn(async () => true);

    constructor(public readonly resource: string) {
      mutexes.taken.push(this);
    }
  },
}));

const randomBytes = vi.hoisted(() => vi.fn(() => Buffer.from("12345")));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return { ...actual, default: { ...actual, randomBytes } };
});

describe("#kuzzle/InternalIndexHandler", () => {
  let handler: InternalIndexHandler;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;

  /** The arguments of every `ask` for one event, in order. */
  const asked = (event: string) =>
    ask.mock.calls
      .filter(([name]) => name === event)
      .map(([, ...args]) => args);

  beforeEach(() => {
    mutexes.taken.length = 0;
    mutexes.granted = true;
    randomBytes.mockClear();

    answers = {};

    ask = vi.fn(async (event: string) => answers[event]);

    stubKuzzle({
      ask,
      config: {
        security: { authToken: {}, jwt: {} },
        services: {
          internalIndex: { bootstrapLockTimeout: 30000 },
          storageEngine: {
            internalIndex: { collections: {}, name: INDEX },
          },
        },
        validation: {},
      },
    });

    handler = new InternalIndexHandler();
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  describe("#init", () => {
    it("creates every internal collection the configuration declares", async () => {
      const collections = {
        bar: { name: "bar" },
        baz: { name: "baz" },
        foo: { name: "foo" },
      };

      global.kuzzle.config.services.storageEngine.internalIndex = invalid({
        collections,
        name: "fooindex",
      });

      handler = new InternalIndexHandler();
      vi.spyOn(handler, "_initSecret").mockResolvedValue(undefined);

      await handler.init();

      /*
       * ⚠️ The fourth argument is the one the Mocha spec did not mention:
       * `should(spy).calledWith(a, b, c)` is satisfied by a call that passed
       * `(a, b, c, d)` — sinon matches a prefix. `createCollections` passes
       * `{ indexCacheOnly }`, and whether the node writes the mappings or
       * only caches them is the difference between the node that won the
       * `Store.init` lock and the ones that waited for it.
       */
      expect(asked("core:storage:private:collection:create")).toEqual(
        expect.arrayContaining([
          [
            "fooindex",
            "foo",
            { mappings: collections.foo },
            { indexCacheOnly: false },
          ],
          [
            "fooindex",
            "bar",
            { mappings: collections.bar },
            { indexCacheOnly: false },
          ],
          [
            "fooindex",
            "baz",
            { mappings: collections.baz },
            { indexCacheOnly: false },
          ],
        ]),
      );
    });

    it("bootstraps under the bootstrap lock, and records that it is done", async () => {
      answers["core:storage:private:document:exist"] = false;
      const bootstrap = vi
        .spyOn(handler, "_bootstrapSequence")
        .mockResolvedValue(undefined);

      await handler.init();

      expect(asked("core:storage:private:document:exist")).toContainEqual([
        INDEX,
        "config",
        `${INDEX}.done`,
      ]);
      expect(bootstrap).toHaveBeenCalledTimes(1);

      /*
       * Two locks, not one: `Store.init` takes its own before creating the
       * collections. The Mocha spec read only the last mutex built, so it
       * could not have said which of the two it was looking at.
       */
      const bootstrapLock = mutexes.taken.find(
        (mutex) => mutex.resource === "InternalIndexBootstrap",
      );

      expect(mutexes.taken.map((mutex) => mutex.resource)).toEqual([
        `Store.init(${INDEX})`,
        "InternalIndexBootstrap",
      ]);
      expect(bootstrapLock?.lock).toHaveBeenCalledTimes(1);
      expect(bootstrapLock?.unlock).toHaveBeenCalledTimes(1);

      expect(asked("core:storage:private:document:create")).toContainEqual([
        INDEX,
        "config",
        { timestamp: expect.any(Number) },
        { id: `${INDEX}.done` },
      ]);
    });

    it("skips the bootstrap when the marker document is already there", async () => {
      answers["core:storage:private:document:exist"] = true;
      const bootstrap = vi.spyOn(handler, "_bootstrapSequence");
      const initSecret = vi
        .spyOn(handler, "_initSecret")
        .mockResolvedValue(undefined);

      await handler.init();

      expect(initSecret).toHaveBeenCalledTimes(1);
      expect(bootstrap).not.toHaveBeenCalled();
      expect(asked("core:storage:private:document:create")).not.toContainEqual(
        expect.arrayContaining([{ id: `${INDEX}.done` }]),
      );
    });

    it("does not record a bootstrap that failed", async () => {
      const failure = new Error("bootstrap failed");

      answers["core:storage:private:document:exist"] = false;
      vi.spyOn(handler, "_bootstrapSequence").mockRejectedValue(failure);

      await expect(handler.init()).rejects.toBe(failure);

      expect(asked("core:storage:private:document:create")).not.toContainEqual(
        expect.arrayContaining([{ id: `${INDEX}.done` }]),
      );
    });

    it("reports a bootstrap that timed out as a Kuzzle error", async () => {
      answers["core:storage:private:document:exist"] = false;
      vi.spyOn(handler, "_bootstrapSequence").mockRejectedValue(
        new Bluebird.TimeoutError(),
      );

      const rejection = handler.init();

      await expect(rejection).rejects.toBeInstanceOf(KuzzleInternalError);
      await expect(rejection).rejects.toMatchObject({
        id: "services.storage.bootstrap_timeout",
      });
    });

    /*
     * Not covered by the Mocha spec, and the reason the `finally` is there: a
     * node that fails to bootstrap must not leave the lock held, or every
     * other node waits for its TTL to expire.
     */
    it("releases the bootstrap lock even when the bootstrap fails", async () => {
      answers["core:storage:private:document:exist"] = false;
      vi.spyOn(handler, "_bootstrapSequence").mockRejectedValue(
        new Error("bootstrap failed"),
      );

      await expect(handler.init()).rejects.toThrow("bootstrap failed");

      const bootstrapLock = mutexes.taken.find(
        (mutex) => mutex.resource === "InternalIndexBootstrap",
      );

      expect(bootstrapLock?.unlock).toHaveBeenCalledTimes(1);
    });
  });

  describe("#_bootstrapSequence", () => {
    it("builds the securities, the validations, the secret and the version marker", async () => {
      const securities = vi
        .spyOn(handler, "createInitialSecurities")
        .mockResolvedValue(undefined);
      const validations = vi
        .spyOn(handler, "createInitialValidations")
        .mockResolvedValue(undefined);
      const initSecret = vi
        .spyOn(handler, "_initSecret")
        .mockResolvedValue(undefined);

      await handler._bootstrapSequence();

      expect(securities).toHaveBeenCalledTimes(1);
      expect(validations).toHaveBeenCalledTimes(1);
      expect(initSecret).toHaveBeenCalledTimes(1);
      expect(asked("core:storage:private:document:create")).toContainEqual([
        INDEX,
        "config",
        { version: expect.any(String) },
        { id: "internalIndex.dataModelVersion" },
      ]);
    });
  });

  describe("#createInitialSecurities", () => {
    /** The three roles and profiles the bootstrap installs. */
    const OPEN_BAR = { controllers: { "*": { actions: { "*": true } } } };

    it("creates the three default roles", async () => {
      await handler.createInitialSecurities();

      for (const role of ["admin", "default", "anonymous"]) {
        expect(
          asked("core:storage:private:document:createOrReplace"),
        ).toContainEqual([
          INDEX,
          "roles",
          role,
          OPEN_BAR,
          { refresh: "wait_for" },
        ]);
      }
    });

    it("creates the three default profiles", async () => {
      await handler.createInitialSecurities();

      const created = asked("core:storage:private:document:createOrReplace");

      expect(created).toContainEqual([
        INDEX,
        "profiles",
        "admin",
        { policies: [{ roleId: "admin" }], rateLimit: 0 },
        { refresh: "wait_for" },
      ]);
      expect(created).toContainEqual([
        INDEX,
        "profiles",
        "default",
        { policies: [{ roleId: "default" }] },
        { refresh: "wait_for" },
      ]);
      expect(created).toContainEqual([
        INDEX,
        "profiles",
        "anonymous",
        { policies: [{ roleId: "anonymous" }] },
        { refresh: "wait_for" },
      ]);
    });

    /*
     * Not covered by the Mocha spec, and it is the whole point of the
     * `admin` profile: an unlimited rate is what lets an operator recover a
     * node that is refusing everyone else.
     */
    it("leaves only the admin profile without a rate limit", async () => {
      await handler.createInitialSecurities();

      const profiles = asked("core:storage:private:document:createOrReplace")
        .filter(([, collection]) => collection === "profiles")
        .map(([, , id, content]) => [
          id,
          (content as { rateLimit?: number }).rateLimit,
        ]);

      expect(profiles).toEqual([
        ["admin", 0],
        ["anonymous", undefined],
        ["default", undefined],
      ]);
    });
  });

  describe("#createInitialValidations", () => {
    it("creates one document per index#collection pair", async () => {
      global.kuzzle.config.validation = invalid({
        index: { collection: { foo: "bar" } },
      });

      await handler.createInitialValidations();

      expect(
        asked("core:storage:private:document:createOrReplace"),
      ).toContainEqual([
        INDEX,
        "validations",
        "index#collection",
        { foo: "bar" },
      ]);
    });

    /* Not covered by the Mocha spec: the default configuration is empty. */
    it("creates nothing when no validation is configured", async () => {
      await handler.createInitialValidations();

      expect(asked("core:storage:private:document:createOrReplace")).toEqual(
        [],
      );
    });
  });

  describe("#_initSecret", () => {
    it("uses the configured secret, and stores nothing", async () => {
      global.kuzzle.config.security.jwt.secret = "foobar";

      await handler._initSecret();

      expect(asked("core:storage:private:document:create")).toEqual([]);
      expect(randomBytes).not.toHaveBeenCalled();
      expect(global.kuzzle.secret).toBe("foobar");
    });

    /*
     * Not covered by the Mocha spec: `authToken.secret ?? jwt.secret`, where
     * `jwt` is the deprecated spelling. Which one wins is the whole reason
     * the fallback is written that way.
     */
    it("prefers authToken.secret over the deprecated jwt.secret", async () => {
      global.kuzzle.config.security.authToken.secret = "from-authToken";
      global.kuzzle.config.security.jwt.secret = "from-jwt";

      await handler._initSecret();

      expect(global.kuzzle.secret).toBe("from-authToken");
    });

    it("generates and stores a seed when neither the config nor the database has one", async () => {
      answers["core:storage:private:document:exists"] = false;
      answers["core:storage:private:document:get"] = {
        _source: { seed: Buffer.from("12345").toString("hex") },
      };

      await handler._initSecret();

      expect(randomBytes).toHaveBeenCalledWith(512);
      expect(asked("core:storage:private:document:create")).toContainEqual([
        INDEX,
        "config",
        { seed: Buffer.from("12345").toString("hex") },
        { id: "security.jwt.secret" },
      ]);
      expect(global.kuzzle.secret).toBe(Buffer.from("12345").toString("hex"));
    });

    /*
     * Not covered by the Mocha spec: a node that restarts finds its seed
     * already stored, must not generate a second one, and must read the
     * stored value back — otherwise every restart invalidates every token.
     */
    it("reads back the stored seed instead of generating another", async () => {
      answers["core:storage:private:document:exist"] = true;
      answers["core:storage:private:document:get"] = {
        _source: { seed: "the-stored-seed" },
      };

      await handler._initSecret();

      expect(randomBytes).not.toHaveBeenCalled();
      expect(asked("core:storage:private:document:create")).toEqual([]);
      expect(global.kuzzle.secret).toBe("the-stored-seed");
    });

    it("forwards a rejection from the document creation", async () => {
      const failure = new Error("could not create");

      ask.mockImplementation(async (event: string) => {
        if (event === "core:storage:private:document:create") {
          throw failure;
        }

        return answers[event];
      });

      await expect(handler._initSecret()).rejects.toBe(failure);
    });
  });
});
