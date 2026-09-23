import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SecurityController from "../../../../lib/api/controllers/securityController";
import { NativeController } from "../../../../lib/api/controllers/baseController";
import { KuzzleRequest } from "../../../../lib/api/request";
import { loadConfig } from "../../../../lib/config";
import { BadRequestError } from "../../../../lib/kerror/errors/badRequestError";
import { PartialError } from "../../../../lib/kerror/errors/partialError";
import { SizeLimitError } from "../../../../lib/kerror/errors/sizeLimitError";
import { invalid } from "../../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../../mocks/kuzzle";

/**
 * `_mDelete` is `protected`, and it is the subject here rather than the
 * `mDelete{Roles,Profiles,Users}` that forward to it — those three are already
 * asserted, one forwarding each, by the sibling specs.
 */
type Internals = {
  _mDelete: (type: string, request: KuzzleRequest) => Promise<string[]>;
};

const internalsOf = (controller: SecurityController) =>
  invalid<Internals>(controller);

describe("#api/controllers/securityController — the controller itself", () => {
  let controller: SecurityController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let refreshCollection: ReturnType<typeof vi.fn>;
  let failures: Map<string, Error>;
  let config: ReturnType<typeof loadConfig>;
  let logger: ReturnType<typeof stubLogger>;

  beforeEach(() => {
    failures = new Map();

    /* `_mDelete` asks one event per id, so a failure is keyed by both. */
    ask = vi.fn(async (event: string, id: string) => {
      const failure = failures.get(`${event}:${id}`);

      if (failure) {
        throw failure;
      }

      return undefined;
    });

    refreshCollection = vi.fn(async () => undefined);

    /* `loadConfig()` answers a shared object, so a test that pins a limit
     * would leak into the next one. */
    config = JSON.parse(JSON.stringify(loadConfig()));
    logger = stubLogger();

    stubKuzzle({
      ask,
      config,
      internalIndex: { refreshCollection },
      log: logger,
      pipe: async () => undefined,
      pluginsManager: { getStrategyMethod: vi.fn(), listStrategies: vi.fn() },
    });

    controller = new SecurityController();
    request = new KuzzleRequest({ controller: "security" }, {});
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  const rejects = async (
    promise: Promise<unknown>,
    match: Record<string, unknown>,
    error: typeof BadRequestError | typeof SizeLimitError = BadRequestError,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(error);
    await expect(promise).rejects.toMatchObject(match);
  };

  describe("#constructor", () => {
    it("should inherit the base constructor", () => {
      expect(new SecurityController()).toBeInstanceOf(NativeController);
    });
  });

  describe("#refresh", () => {
    /**
     * ⚠️ The Mocha spec asserted `kuzzle.ask("core:storage:private:collection:refresh", …)`,
     * which the controller does not call: it calls
     * `internalIndex.refreshCollection(collection)`, and that event is what the
     * real `Store` wrapper emits one layer below. The assertion held only
     * because `KuzzleMock.internalIndex` extends the real handler. What the
     * subject does is the call, so that is what is asserted here.
     */
    it("should refresh each of the security collections", async () => {
      for (const collection of ["users", "roles", "profiles"]) {
        request.input.args.collection = collection;

        await expect(controller.refresh(request)).resolves.toBeNull();

        expect(refreshCollection).toHaveBeenCalledWith(collection);
      }

      expect(refreshCollection).toHaveBeenCalledTimes(3);
    });

    it("should reject an unknown collection and refresh nothing", async () => {
      request.input.args.collection = "frontend-security";

      await expect(controller.refresh(request)).rejects.toMatchObject({
        id: "api.assert.unexpected_argument",
      });

      expect(refreshCollection).not.toHaveBeenCalled();
    });
  });

  describe("#_mDelete", () => {
    const types = ["role", "profile", "user"];

    beforeEach(() => {
      request.input.body = { ids: ["foo", "bar", "baz"] };
    });

    it("should reject if the request has no body", async () => {
      request.input.body = null;

      await rejects(internalsOf(controller)._mDelete("type", request), {
        id: "api.assert.body_required",
      });
    });

    it("should reject if the request has no ids to delete", async () => {
      request.input.body = {};

      await rejects(internalsOf(controller)._mDelete("type", request), {
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if ids is not an array", async () => {
      request.input.body = { ids: {} };

      await rejects(internalsOf(controller)._mDelete("type", request), {
        id: "api.assert.invalid_type",
      });
    });

    it("should reject if the number of documents exceeds the server limit", async () => {
      config.limits.documentsWriteCount = 1;

      await rejects(
        internalsOf(controller)._mDelete("type", request),
        { id: "services.storage.write_limit_exceeded" },
        SizeLimitError,
      );

      expect(ask).not.toHaveBeenCalled();
    });

    it.each(types)(
      "should delete every %s of the list and answer their ids",
      async (type) => {
        await expect(
          internalsOf(controller)._mDelete(type, request),
        ).resolves.toEqual(["foo", "bar", "baz"]);

        for (const id of ["foo", "bar", "baz"]) {
          expect(ask).toHaveBeenCalledWith(`core:security:${type}:delete`, id, {
            refresh: "wait_for",
          });
        }
      },
    );

    it.each(types)(
      "should forward the refresh option for %ss",
      async (type) => {
        request.input.args.refresh = false;

        await expect(
          internalsOf(controller)._mDelete(type, request),
        ).resolves.toEqual(["foo", "bar", "baz"]);

        for (const id of ["foo", "bar", "baz"]) {
          expect(ask).toHaveBeenCalledWith(`core:security:${type}:delete`, id, {
            refresh: "false",
          });
        }
      },
    );

    it("should set a partial error and answer the ids that did delete", async () => {
      const error = new Error("test");

      failures.set("core:security:profile:delete:bar", error);

      await expect(
        internalsOf(controller)._mDelete("profile", request),
      ).resolves.toEqual(["foo", "baz"]);

      expect(request.error).toBeInstanceOf(PartialError);
      expect(request.error).toMatchObject({
        id: "services.storage.incomplete_delete",
      });
      expect((request.error as PartialError).errors).toEqual([error]);
    });

    /**
     * The log line the subject writes is the audit trail of a bulk security
     * deletion, and above a thousand ids it writes a different one — a branch
     * no Mocha test entered.
     */
    it("should log every deleted id", async () => {
      await internalsOf(controller)._mDelete("user", request);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("deleted the following users: foo, bar, baz."),
      );
    });

    it("should truncate the log line past a thousand ids", async () => {
      const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);

      config.limits.documentsWriteCount = ids.length;
      request.input.body = { ids };

      await expect(
        internalsOf(controller)._mDelete("user", request),
      ).resolves.toHaveLength(1001);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("... (1 more users deleted)."),
      );
    });
  });
});
