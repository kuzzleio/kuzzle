import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import SecurityLoader from "../../../lib/core/security/securityLoader";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";
import securities from "../../fixtures/securities.json";

/*
 * `securities.json` moved from `test/mocks/` to `tests/fixtures/`: it is a
 * payload, not a mock — nothing in it stands in for a collaborator, and it is
 * the only file this spec loaded from that directory.
 */
describe("#core/security/SecurityLoader", () => {
  let loader: SecurityLoader;
  let processRequest: ReturnType<typeof vi.fn>;
  let refreshCollection: ReturnType<typeof vi.fn>;
  let asked: Map<string, (...args: unknown[]) => unknown>;

  beforeEach(async () => {
    /*
     * The loader turns a securities payload into API requests and hands each
     * one to the funnel. So the fixture is the funnel, the index refresh it
     * waits on afterwards, and `onAsk` for the event it answers.
     */
    asked = new Map();
    processRequest = vi.fn(async () => undefined);
    refreshCollection = vi.fn(async () => undefined);

    stubKuzzle({
      funnel: { processRequest },
      internalIndex: { refreshCollection },
      onAsk: (event: string, handler: (...args: unknown[]) => unknown) => {
        asked.set(event, handler);
      },
    });

    loader = new SecurityLoader();
    await loader.init();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** The requests handed to the funnel, in order. */
  const requests = () => processRequest.mock.calls.map(([request]) => request);

  it("is what the security:load event calls", () => {
    const load = vi.spyOn(loader, "load").mockResolvedValue(undefined);

    asked.get("core:security:load")("json", "opts");

    expect(load).toHaveBeenCalledWith("json", "opts");
  });

  it("creates or replaces each role, carrying the force flag", async () => {
    processRequest.mockResolvedValue(true);

    await loader.load({ roles: securities.roles }, { force: true });

    expect(processRequest).toHaveBeenCalledTimes(2);

    const [first, second] = requests();

    expect(first.input.action).toBe("createOrReplaceRole");
    expect(second.input.action).toBe("createOrReplaceRole");
    expect(first.input.args._id).toBe("driver");
    expect(first.input.args.force).toBe(true);
    expect(first.input.body.controllers.document.actions["*"]).toBe(true);
    /*
     * Not asserted by the Mocha spec, which read `_id` off the first call and
     * the action off the second: both roles must be loaded, and which one is
     * which matters.
     */
    expect(second.input.args._id).toBe("customer");
  });

  it("creates or replaces each profile with its policies", async () => {
    processRequest.mockResolvedValue(true);

    await loader.load({ profiles: securities.profiles });

    expect(processRequest).toHaveBeenCalledTimes(2);

    const second = requests()[1];

    expect(second.input.action).toBe("createOrReplaceProfile");
    expect(second.input.args._id).toBe("customer");
    expect(second.input.body.policies[0].roleId).toBe("customer");
  });

  describe("existing users", () => {
    beforeEach(() => {
      /* `gfreeman` already exists; `bcalhoun` does not. */
      processRequest.mockResolvedValueOnce({
        result: { hits: [{ _id: "gfreeman" }] },
      });
    });

    it("refuses to overwrite one by default", async () => {
      const rejection = loader.load({ users: securities.users });

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.user.prevent_overwrite",
      });
    });

    it('creates only the new ones when told to "skip"', async () => {
      await loader.load(
        { users: securities.users },
        { onExistingUsers: "skip" },
      );

      expect(processRequest).toHaveBeenCalledTimes(2);

      const [lookup, create] = requests();

      expect(lookup.input.action).toBe("mGetUsers");
      expect(lookup.input.body.ids).toEqual(["gfreeman", "bcalhoun"]);
      expect(create.input.action).toBe("createUser");
      expect(create.input.args._id).toBe("bcalhoun");
      expect(create.input.body.content.profileIds).toEqual(["customer"]);
    });

    it('deletes only the existing ones when told to "overwrite"', async () => {
      await loader.load(
        { users: securities.users },
        { onExistingUsers: "overwrite" },
      );

      expect(processRequest).toHaveBeenCalledTimes(4);

      const [lookup, remove, create] = requests();

      expect(lookup.input.action).toBe("mGetUsers");
      expect(lookup.input.body.ids).toEqual(["gfreeman", "bcalhoun"]);
      expect(remove.input.action).toBe("mDeleteUsers");
      /* Only the one that exists — deleting `bcalhoun` would be a 404. */
      expect(remove.input.body.ids).toEqual(["gfreeman"]);
      expect(create.input.action).toBe("createUser");
      expect(create.input.args._id).toBe("gfreeman");
      expect(create.input.body.content.profileIds).toEqual(["driver"]);
    });
  });

  describe("payload validation", () => {
    it("rejects a null payload", async () => {
      const rejection = loader.load(null);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.invalid_argument",
        message: 'Invalid argument "null". Expected: object',
      });
    });

    it.each(["roles", "profiles", "users"] as const)(
      "rejects a non-object under %s",
      async (section) => {
        processRequest.mockResolvedValue({ result: { hits: [] } });

        const rejection = loader.load({
          profiles: {},
          roles: {},
          users: {},
          [section]: { foo: 123 },
        });

        await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
        await expect(rejection).rejects.toMatchObject({
          id: "api.assert.invalid_argument",
          message: 'Invalid argument "123". Expected: object',
        });
      },
    );
  });
});
