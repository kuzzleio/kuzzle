import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SecurityController from "../../../../lib/api/controllers/securityController";
import { KuzzleRequest } from "../../../../lib/api/request";
import { BadRequestError } from "../../../../lib/kerror/errors/badRequestError";
import { SizeLimitError } from "../../../../lib/kerror/errors/sizeLimitError";
import { Role } from "../../../../lib/model/security/role";
import { invalid } from "../../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";
import { bodyOf } from "../../../helpers/request";

/** A role as the security module answers it. */
const role = (id: string) => {
  const created = new Role();

  created._id = id;
  Object.assign(created, { controllers: { ctrl: true }, foo: "bar" });

  return created;
};

describe("#api/controllers/securityController — roles", () => {
  let controller: SecurityController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let failures: Map<string, Error>;
  let internalIndex: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    answers = {};
    failures = new Map();

    ask = vi.fn(async (event: string) => {
      const failure = failures.get(event);

      if (failure) {
        throw failure;
      }

      return answers[event];
    });

    /* The mapping actions go through the InternalIndexHandler, not through the
     * `core:storage:private:mappings:*` events the Mocha spec asserted on —
     * the third spec in this step to have aimed one layer too low. */
    internalIndex = {
      getMapping: vi.fn(async () => ({ properties: { foo: "bar" } })),
      refreshCollection: vi.fn(async () => undefined),
      updateMapping: vi.fn(
        async (collection: string, mappings: unknown) => mappings,
      ),
    };

    stubKuzzle({
      ask,
      internalIndex,
      pipe: async () => undefined,
      pluginsManager: { getStrategyMethod: () => undefined },
      config: { limits: { documentsFetchCount: 10000 } },
    });

    controller = new SecurityController();
    request = new KuzzleRequest(
      { controller: "security" },
      { user: { _id: "4" } },
    );
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** The arguments the security module was asked that event with. */
  const asked = (event: string) =>
    ask.mock.calls.find(([name]) => name === event);

  /** Both halves of a rejection, in one call. */
  const rejects = async (
    promise: Promise<unknown>,
    id: string,
    error: typeof BadRequestError | typeof SizeLimitError = BadRequestError,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(error);
    await expect(promise).rejects.toMatchObject({ id });
  };

  describe("#updateRoleMapping", () => {
    it("should reject if the body is missing", async () => {
      /* `updateRoleMapping` IS `async`, so a missing body rejects — while its
       * `profiles` twin, three methods down, is not and throws. The two specs
       * were written against that asymmetry without noticing it. */
      await rejects(
        controller.updateRoleMapping(request),
        "api.assert.body_required",
      );

      expect(internalIndex.updateMapping).not.toHaveBeenCalled();
    });

    it("should update the role mapping", async () => {
      request.input.body = { foo: "bar" };

      await expect(
        controller.updateRoleMapping(request),
      ).resolves.toMatchObject({ foo: "bar" });
      expect(internalIndex.updateMapping).toHaveBeenCalledWith("roles", {
        foo: "bar",
      });
    });
  });

  describe("#getRoleMapping", () => {
    it("should answer the stored mapping", async () => {
      await expect(controller.getRoleMapping()).resolves.toMatchObject({
        mapping: { foo: "bar" },
      });
      expect(internalIndex.getMapping).toHaveBeenCalledWith("roles");
    });
  });

  describe.each([
    ["createOrReplaceRole", "core:security:role:createOrReplace"],
    ["createRole", "core:security:role:create"],
  ] as const)("#%s", (action, event) => {
    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = { foo: "bar" };
      answers[event] = role("test");
    });

    it("should create the role with the default options", async () => {
      const response = await controller[action](request);

      expect(asked(event)).toEqual([
        event,
        "test",
        { foo: "bar" },
        { force: false, refresh: "wait_for", userId: "4" },
      ]);
      expect(response).not.toBeInstanceOf(Role);
      expect(response).toMatchObject({
        _id: "test",
        _source: { controllers: { ctrl: true }, foo: "bar" },
      });
    });

    it("should forward the request options", async () => {
      request.input.args.force = true;
      request.input.args.refresh = false;

      await controller[action](request);

      expect(asked(event)).toEqual([
        event,
        "test",
        { foo: "bar" },
        { force: true, refresh: "false", userId: "4" },
      ]);
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foo");
      failures.set(event, error);

      await expect(controller[action](request)).rejects.toBe(error);
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await rejects(controller[action](request), "api.assert.missing_argument");
      expect(asked(event)).toBeUndefined();
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await rejects(controller[action](request), "api.assert.body_required");
      expect(asked(event)).toBeUndefined();
    });
  });

  describe("#getRole", () => {
    const event = "core:security:role:get";

    beforeEach(() => {
      request.input.args._id = "test";
      answers[event] = role("foo");
    });

    it("should answer a serialized role", async () => {
      const response = await controller.getRole(request);

      expect(response).not.toBeInstanceOf(Role);
      expect(response).toMatchObject({
        _id: "foo",
        _source: { controllers: { ctrl: true }, foo: "bar" },
      });
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foo");
      failures.set(event, error);

      await expect(controller.getRole(request)).rejects.toBe(error);
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await rejects(controller.getRole(request), "api.assert.missing_argument");
      expect(asked(event)).toBeUndefined();
    });
  });

  describe("#mGetRoles", () => {
    const event = "core:security:role:mGet";

    beforeEach(() => {
      request.input.body = { ids: "foobar".split("") };
      answers[event] = ["role1", "role2", "role3"].map(role);
    });

    it("should answer one serialized role per id", async () => {
      const response = await controller.mGetRoles(request);

      expect(asked(event)).toEqual([event, bodyOf(request).ids]);
      expect(response.hits).toHaveLength(3);
      response.hits.forEach((hit: { _id: string }, i: number) => {
        expect(hit).not.toBeInstanceOf(Role);
        expect(hit._id).toBe(`role${i + 1}`);
      });
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await rejects(controller.mGetRoles(request), "api.assert.body_required");
      expect(asked(event)).toBeUndefined();
    });

    it("should reject if no ids are provided", async () => {
      delete (request.input.body as Record<string, unknown>).ids;

      await rejects(
        controller.mGetRoles(request),
        "api.assert.missing_argument",
      );
      expect(asked(event)).toBeUndefined();
    });

    it("should reject if ids is not an array", async () => {
      (request.input.body as Record<string, unknown>).ids = "foobar";

      await rejects(controller.mGetRoles(request), "api.assert.invalid_type");
      expect(asked(event)).toBeUndefined();
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foo");
      failures.set(event, error);

      await expect(controller.mGetRoles(request)).rejects.toBe(error);
    });
  });

  describe("#searchRoles", () => {
    const event = "core:security:role:search";

    beforeEach(() => {
      request.input.body = { controllers: "foobar".split("") };
      answers[event] = { hits: [role("foo")], total: 1 };
    });

    it("should answer serialized roles", async () => {
      const response = await controller.searchRoles(request);

      expect(response.hits).toHaveLength(1);
      expect(response.hits[0]).not.toBeInstanceOf(Role);
      expect(response.hits[0]).toMatchObject({
        _id: "foo",
        _source: { controllers: { ctrl: true }, foo: "bar" },
      });
      expect(asked(event)).toEqual([
        event,
        { controllers: bodyOf(request).controllers },
        { from: 0, size: 10000 },
      ]);
    });

    it("should search every controller when none are given", async () => {
      delete (request.input.body as Record<string, unknown>).controllers;
      await controller.searchRoles(request);
      expect(asked(event)).toEqual([event, {}, { from: 0, size: 10000 }]);

      ask.mockClear();
      request.input.body = null;
      await controller.searchRoles(request);
      expect(asked(event)).toEqual([event, {}, { from: 0, size: 10000 }]);
    });

    it('should reject if the "size" option exceeds the server limit', async () => {
      global.kuzzle.config.limits.documentsFetchCount = 1;
      request.input.args.size = 10;

      await rejects(
        controller.searchRoles(request),
        "services.storage.get_limit_exceeded",
        SizeLimitError,
      );
      expect(asked(event)).toBeUndefined();
    });

    it('should reject if "controllers" is not an array', async () => {
      (request.input.body as Record<string, unknown>).controllers = "foo";

      await rejects(controller.searchRoles(request), "api.assert.invalid_type");
      expect(asked(event)).toBeUndefined();
    });

    it.each([true, false, {}, [], "foo", 12.34])(
      'should reject the invalid "from" %s',
      async (from) => {
        request.input.args.from = invalid<number>(from);

        await rejects(
          controller.searchRoles(request),
          "api.assert.invalid_type",
        );
        expect(asked(event)).toBeUndefined();
      },
    );

    it.each([true, false, {}, [], "foo", 12.34])(
      'should reject the invalid "size" %s',
      async (size) => {
        request.input.args.size = invalid<number>(size);

        await rejects(
          controller.searchRoles(request),
          "api.assert.invalid_type",
        );
        expect(asked(event)).toBeUndefined();
      },
    );

    it("should forward a security module exception", async () => {
      const error = new Error("foo");
      failures.set(event, error);

      await expect(controller.searchRoles(request)).rejects.toBe(error);
    });
  });

  describe("#updateRole", () => {
    const event = "core:security:role:update";

    beforeEach(() => {
      request.input.args._id = "test";
      request.input.body = { foo: "bar" };
      answers[event] = role("test");
    });

    it("should update with the default options", async () => {
      const response = await controller.updateRole(request);

      expect(asked(event)).toEqual([
        event,
        "test",
        { foo: "bar" },
        {
          force: false,
          refresh: "wait_for",
          retryOnConflict: 10,
          userId: "4",
        },
      ]);
      expect(response).not.toBeInstanceOf(Role);
      expect(response).toMatchObject({
        _id: "test",
        _source: { controllers: { ctrl: true }, foo: "bar" },
      });
    });

    it("should forward the request options", async () => {
      request.input.args.force = true;
      request.input.args.refresh = false;
      request.input.args.retryOnConflict = 123;

      await controller.updateRole(request);

      expect(asked(event)).toEqual([
        event,
        "test",
        { foo: "bar" },
        {
          force: true,
          refresh: "false",
          retryOnConflict: 123,
          userId: "4",
        },
      ]);
    });

    it("should reject if no id is given", async () => {
      request.input.args._id = null;

      await rejects(
        controller.updateRole(request),
        "api.assert.missing_argument",
      );
      expect(asked(event)).toBeUndefined();
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await rejects(controller.updateRole(request), "api.assert.body_required");
      expect(asked(event)).toBeUndefined();
    });

    it("should forward a security module exception", async () => {
      const error = new Error("foo");
      failures.set(event, error);

      await expect(controller.updateRole(request)).rejects.toBe(error);
    });
  });

  describe("#deleteRole", () => {
    const event = "core:security:role:delete";

    beforeEach(() => {
      request.input.args._id = "test";
    });

    it("should delete with the default options", async () => {
      await expect(controller.deleteRole(request)).resolves.toMatchObject({
        _id: "test",
      });
      expect(asked(event)).toEqual([event, "test", { refresh: "wait_for" }]);
    });

    it("should forward the request options", async () => {
      request.input.args.refresh = false;

      await controller.deleteRole(request);

      expect(asked(event)).toEqual([event, "test", { refresh: "false" }]);
    });

    it("should reject if no id is provided", async () => {
      request.input.args._id = null;

      await rejects(
        controller.deleteRole(request),
        "api.assert.missing_argument",
      );
      expect(asked(event)).toBeUndefined();
    });
  });

  describe("#mDeleteRoles", () => {
    it("should forward to _mDelete and answer its result", async () => {
      const mDelete = vi
        .spyOn(
          controller as unknown as { _mDelete: () => Promise<string> },
          "_mDelete",
        )
        .mockResolvedValue("foobar");

      await expect(controller.mDeleteRoles(request)).resolves.toBe("foobar");
      expect(mDelete).toHaveBeenCalledWith("role", request);
    });
  });
});
