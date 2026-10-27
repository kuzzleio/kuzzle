import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminController from "../../../lib/api/controllers/adminController";
import { NativeController } from "../../../lib/api/controllers/baseController";
import { KuzzleRequest } from "../../../lib/api/request";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { MutexAcquireError } from "../../../lib/util/distributedLock";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

/**
 * Every lock the controller takes, and whether it was granted.
 *
 * `resetSecurity` and `resetDatabase` both take their lock with no retry:
 * they either get it immediately or refuse the request. A refused lock
 * throws the real `MutexAcquireError`, as `withLock` does.
 */
const locks = vi.hoisted(() => {
  const taken: {
    config: { retryAttempts?: number } | undefined;
    released: boolean;
    resource: string;
  }[] = [];

  return { granted: true, taken };
});

vi.mock("../../../lib/util/distributedLock", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../lib/util/distributedLock")>();

  return {
    ...original,
    withLock: vi.fn(
      async (
        resource: string,
        callback: () => Promise<unknown>,
        config?: { retryAttempts?: number },
      ) => {
        const lock = { config, released: false, resource };
        locks.taken.push(lock);

        if (!locks.granted) {
          throw new original.MutexAcquireError(resource, 1);
        }

        try {
          return await callback();
        } finally {
          lock.released = true;
        }
      },
    ),
  };
});

describe("#api/controllers/AdminController", () => {
  let controller: AdminController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let createInitialSecurities: ReturnType<typeof vi.fn>;
  let dump: ReturnType<typeof vi.fn>;
  let shutdown: ReturnType<typeof vi.fn>;
  let logger: ReturnType<typeof stubLogger>;

  /** The arguments of every `ask` for one event, in order. */
  const asked = (event: string) =>
    ask.mock.calls
      .filter(([name]) => name === event)
      .map(([, ...args]) => args);

  /** The lock taken for `resource`, if any. */
  const lockOn = (resource: string) =>
    locks.taken.find((lock) => lock.resource === resource);

  beforeEach(() => {
    locks.taken.length = 0;
    locks.granted = true;

    answers = {};
    ask = vi.fn(async (event: string) => answers[event]);
    createInitialSecurities = vi.fn(async () => undefined);
    dump = vi.fn(async () => undefined);
    shutdown = vi.fn();
    logger = stubLogger();

    stubKuzzle({
      ask,
      dump,
      internalIndex: { createInitialSecurities },
      log: logger,
      /* `NativeController`'s constructor binds both buses. */
      pipe: async (_event: string, payload: unknown) => payload,
      shutdown,
    });

    controller = new AdminController();

    request = new KuzzleRequest({ controller: "admin" });
    request.input.args.refresh = "wait_for";
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#constructor", () => {
    it("is a native controller", () => {
      expect(controller).toBeInstanceOf(NativeController);
    });

    /*
     * Not covered by the Mocha spec: the action list is what `_isAction`
     * answers from, so an action missing from it is an action the API
     * refuses even though the method exists.
     */
    it("exposes its nine actions", () => {
      expect([...controller._actions].sort()).toEqual([
        "dump",
        "loadFixtures",
        "loadMappings",
        "loadSecurities",
        "refreshIndexCache",
        "resetCache",
        "resetDatabase",
        "resetSecurity",
        "shutdown",
      ]);
    });
  });

  describe("#refreshIndexCache", () => {
    it("asks the public storage to refresh its cache", async () => {
      await controller.refreshIndexCache();

      expect(asked("core:storage:public:cache:refresh")).toHaveLength(1);
    });
  });

  describe("#resetCache", () => {
    it.each([
      ["memoryStorage", "core:cache:public:flushdb"],
      ["internalCache", "core:cache:internal:flushdb"],
    ])("flushes the %s database", async (database, event) => {
      request.input.args.database = database;

      expect(await controller.resetCache(request)).toEqual({
        acknowledge: true,
      });
      expect(asked(event)).toHaveLength(1);
    });

    it("refuses a database it does not know", async () => {
      request.input.args.database = "city17";

      const rejection = controller.resetCache(request);

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "services.cache.database_not_found",
      });
    });

    /* Not covered by the Mocha spec: neither cache is touched on refusal. */
    it("flushes nothing when it refuses", async () => {
      request.input.args.database = "city17";

      await expect(controller.resetCache(request)).rejects.toMatchObject({
        id: "services.cache.database_not_found",
      });

      expect(asked("core:cache:public:flushdb")).toEqual([]);
      expect(asked("core:cache:internal:flushdb")).toEqual([]);
    });
  });

  describe("#resetSecurity", () => {
    beforeEach(() => {
      answers["core:security:user:truncate"] = 3;
      answers["core:security:profile:truncate"] = 2;
      answers["core:security:role:truncate"] = 1;
    });

    it("truncates users, then profiles, then roles, then rebuilds the defaults", async () => {
      const result = await controller.resetSecurity();

      /*
       * The order is the contract — a profile cannot be deleted while a user
       * still references it — and the Mocha spec said so with
       * `sinon.assert.callOrder`. Here the whole sequence is one assertion,
       * so an event inserted in the middle of it is named.
       */
      expect(
        ask.mock.calls
          .map(([event]) => event)
          .filter((event) => event !== "core:cache:internal:del"),
      ).toEqual([
        "core:security:user:truncate",
        "core:security:profile:truncate",
        "core:security:role:truncate",
      ]);
      expect(createInitialSecurities).toHaveBeenCalledTimes(1);
      expect(asked("core:cache:internal:del")).toEqual([
        ["backend:init:import:permissions"],
      ]);

      /*
       * Not covered by the Mocha spec, which asserted the calls and dropped
       * the answer: the counts are what the API responds with.
       */
      expect(result).toEqual({
        deletedProfiles: 2,
        deletedRoles: 1,
        deletedUsers: 3,
      });
    });

    it("takes a non-blocking lock on the action", async () => {
      await controller.resetSecurity();

      const lock = lockOn("resetSecurity");

      expect(lock?.config).toEqual({ retryAttempts: 0 });
      expect(lock?.released).toBe(true);
    });

    it("releases the lock even when a truncation fails", async () => {
      ask.mockImplementation(async (event: string) => {
        if (event === "core:security:user:truncate") {
          throw new Error("truncation failed");
        }

        return answers[event];
      });

      await expect(controller.resetSecurity()).rejects.toThrow(
        "truncation failed",
      );

      expect(lockOn("resetSecurity")?.released).toBe(true);
    });

    it("refuses when a reset is already underway", async () => {
      locks.granted = false;

      const rejection = controller.resetSecurity();

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.process.action_locked",
      });
      expect(lockOn("resetSecurity")?.released).toBe(false);
    });
  });

  /* Only the reset's own lock being held means "already underway". */
  describe("#failIfLocked", () => {
    it("lets through a MutexAcquireError thrown by the reset itself", async () => {
      const failure = new MutexAcquireError("some other lock", 1);
      ask.mockRejectedValue(failure);

      await expect(controller.resetDatabase()).rejects.toBe(failure);
    });
  });

  describe("#resetDatabase", () => {
    beforeEach(() => {
      answers["core:storage:public:index:list"] = ["a", "b", "c"];
    });

    it("deletes every index the public storage lists", async () => {
      expect(await controller.resetDatabase()).toEqual({ acknowledge: true });

      expect(asked("core:storage:public:index:list")).toHaveLength(1);
      expect(asked("core:storage:public:index:mDelete")).toEqual([
        [["a", "b", "c"]],
      ]);
      expect(asked("core:cache:internal:del")).toEqual([
        ["backend:init:import:mappings"],
      ]);
    });

    it("takes a non-blocking lock on the action", async () => {
      await controller.resetDatabase();

      const lock = lockOn("resetDatabase");

      expect(lock?.config).toEqual({ retryAttempts: 0 });
      expect(lock?.released).toBe(true);
    });

    /* Not covered by the Mocha spec, and the reason for the `finally`. */
    it("releases the lock even when the deletion fails", async () => {
      ask.mockImplementation(async (event: string) => {
        if (event === "core:storage:public:index:mDelete") {
          throw new Error("deletion failed");
        }

        return answers[event];
      });

      await expect(controller.resetDatabase()).rejects.toThrow(
        "deletion failed",
      );

      expect(lockOn("resetDatabase")?.released).toBe(true);
    });

    it("refuses when a reset is already underway", async () => {
      locks.granted = false;

      const rejection = controller.resetDatabase();

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.process.action_locked",
      });
      expect(asked("core:storage:public:index:list")).toEqual([]);
    });
  });

  describe("#dump", () => {
    it("dumps under the suffix it was given", async () => {
      request.input.args.suffix = "dump-me-master";

      expect(await controller.dump(request)).toEqual({ acknowledge: true });
      expect(dump).toHaveBeenCalledWith("dump-me-master");
    });

    /* Not covered by the Mocha spec: the suffix has a default. */
    it("dumps under a default suffix when given none", async () => {
      await controller.dump(request);

      expect(dump).toHaveBeenCalledWith("manual-api-action");
    });
  });

  describe("#shutdown", () => {
    it("shuts the node down", async () => {
      expect(await controller.shutdown()).toEqual({ acknowledge: true });
      expect(shutdown).toHaveBeenCalledTimes(1);
    });

    it("refuses a second shutdown while one is in progress", async () => {
      /*
       * `shuttingDown` is `protected`: the flag is set by the shutdown path
       * itself, and the suite it replaces set it from the outside too.
       */
      (controller as unknown as { shuttingDown: boolean }).shuttingDown = true;

      const rejection = controller.shutdown();

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.process.action_locked",
      });
      expect(shutdown).not.toHaveBeenCalled();
    });

    // The flag was declared and checked, but never set: the guard never fired.
    it("refuses a second call once the first has started the shutdown", async () => {
      await controller.shutdown();

      await expect(controller.shutdown()).rejects.toMatchObject({
        id: "api.process.action_locked",
      });
      expect(shutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe("#loadMappings", () => {
    it("imports the body as raw mappings", async () => {
      request.input.body = { city: { seventeen: {} } };

      expect(await controller.loadMappings(request)).toEqual({
        acknowledge: true,
      });
      expect(asked("core:storage:public:mappings:import")).toEqual([
        [{ city: { seventeen: {} } }, { rawMappings: true }],
      ]);
    });
  });

  describe("#loadFixtures", () => {
    it("imports the body, carrying the refresh through", async () => {
      request.input.body = { city: { seventeen: [] } };
      request.input.args.refresh = "false";

      await controller.loadFixtures(request);

      expect(asked("core:storage:public:document:import")).toEqual([
        [{ city: { seventeen: [] } }, { refresh: "false" }],
      ]);
    });

    // The documented answer; 2.17.6 to 2.59 answered the import's `undefined`.
    it("answers an acknowledgement once the fixtures are loaded", async () => {
      request.input.body = { city: { seventeen: [] } };

      expect(await controller.loadFixtures(request)).toEqual({
        acknowledge: true,
      });
    });

    // Unlike loadMappings: refresh=false does not detach the import, so its
    // failure still reaches the caller.
    it("reports a failed import even with refresh=false", async () => {
      request.input.body = { city: { seventeen: [] } };
      request.input.args.refresh = "false";
      const error = new Error("import failed");
      ask.mockRejectedValueOnce(error);

      await expect(controller.loadFixtures(request)).rejects.toBe(error);
    });
  });

  describe("#loadSecurities", () => {
    it("loads the body with the options the request carries", async () => {
      request.input.args.onExistingUsers = "overwrite";
      request.input.body = { gordon: { freeman: [] } };

      expect(await controller.loadSecurities(request)).toEqual({
        acknowledge: true,
      });
      expect(asked("core:security:load")).toEqual([
        [
          { gordon: { freeman: [] } },
          {
            force: false,
            onExistingUsers: "overwrite",
            refresh: "wait_for",
            user: null,
          },
        ],
      ]);
    });
  });

  /*
   * ⚠️ Not covered by the Mocha spec at all, and it is the branch three of
   * these actions share: `refresh: "false"` means *do not wait* — the action
   * answers `{ acknowledge: true }` immediately and the work runs on. The
   * failure of that detached promise is swallowed into a log line, which is
   * the only place it is ever reported.
   */
  describe("#_waitForAction", () => {
    it("answers immediately when the caller does not want to wait", async () => {
      let resolveImport: () => void = () => undefined;

      ask.mockImplementation(
        async (event: string) =>
          new Promise<void>((resolve) => {
            if (event === "core:storage:public:mappings:import") {
              resolveImport = resolve;
            }
          }),
      );

      request.input.args.refresh = "false";
      request.input.body = {};

      /* Resolves although the import has not. */
      expect(await controller.loadMappings(request)).toEqual({
        acknowledge: true,
      });

      resolveImport();
    });

    it("logs the failure of an action nobody is waiting for", async () => {
      const failure = new Error("import failed");

      ask.mockRejectedValue(failure);

      request.input.args.refresh = "false";
      request.input.body = {};

      await controller.loadMappings(request);
      /* The rejection is handled on a later tick. */
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith(failure);
    });
  });
});
