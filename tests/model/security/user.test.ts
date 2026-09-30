import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Request } from "../../../lib/api/request/kuzzleRequest";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { Profile } from "../../../lib/model/security/profile";
import { User } from "../../../lib/model/security/user";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/** A policy whose role answers `allowed` to every restriction check. */
const policy = (allowed: boolean) => ({
  role: { checkRestrictions: vi.fn(() => allowed) },
  restrictedTo: new Map(),
});

/** One entry of what `getRights()` answers. */
type RightsItem = {
  controller: string;
  action: string;
  index: string;
  collection: string;
  value: string;
};

describe("#model/security/User", () => {
  let profile: Profile;
  let profile2: Profile;
  let profilePolicies: ReturnType<typeof policy>[];
  let profilePolicies2: ReturnType<typeof policy>[];
  let user: User;

  beforeEach(() => {
    profile = new Profile();
    profile._id = "profile";
    profile.isActionAllowed = vi.fn(async () => true);
    profilePolicies = [policy(false), policy(false)];
    profile.getAllowedPolicies = vi.fn(async () =>
      invalid<Awaited<ReturnType<Profile["getAllowedPolicies"]>>>(
        profilePolicies,
      ),
    );

    profile2 = new Profile();
    profile2._id = "profile2";
    profile2.isActionAllowed = vi.fn(async () => false);
    profilePolicies2 = [policy(false), policy(true)];
    profile2.getAllowedPolicies = vi.fn(async () =>
      invalid<Awaited<ReturnType<Profile["getAllowedPolicies"]>>>(
        profilePolicies2,
      ),
    );

    user = new User();
    user.profileIds = ["profile", "profile2"];

    /*
     * The one thing `User` asks the application for: its profiles. The Mocha
     * spec reached that through a KuzzleMock whose `ask` was stubbed
     * `withArgs`; here the fixture answers the event by name and throws on any
     * other, so a spec that grows a second dependency says so.
     */
    stubKuzzle({
      ask: vi.fn(async (event: string) => {
        if (event === "core:security:profile:mGet") {
          return [profile, profile2];
        }

        throw new Error(`unexpected ask("${event}")`);
      }),
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("should merge the rights of every profile", async () => {
    const profileRights = {
      rights1: {
        controller: "document",
        action: "get",
        index: "foo",
        collection: "bar",
        value: "allowed",
      },
      rights4: {
        controller: "document",
        action: "delete",
        index: "foo",
        collection: "bar",
        value: "denied",
      },
    };
    const profileRights2 = {
      rights1: {
        controller: "document",
        action: "get",
        index: "foo",
        collection: "bar",
        value: "denied",
      },
      rights3: {
        controller: "document",
        action: "create",
        index: "foo",
        collection: "bar",
        value: "allowed",
      },
    };

    profile.getRights = vi.fn(async () => profileRights);
    profile2.getRights = vi.fn(async () => profileRights2);

    const rights = Object.values(await user.getRights()) as RightsItem[];

    const right = (action: string) =>
      rights.filter(
        (item) => item.controller === "document" && item.action === action,
      );

    expect(right("get")).toHaveLength(1);
    expect(right("get")[0]).toMatchObject({
      index: "foo",
      collection: "bar",
      // "allowed" wins over the "denied" the second profile carries for the
      // same right: that is what `Rights.merge` is for.
      value: "allowed",
    });

    expect(right("delete")).toHaveLength(1);
    expect(right("delete")[0]).toMatchObject({
      index: "foo",
      collection: "bar",
      value: "denied",
    });

    expect(right("create")).toHaveLength(1);
    expect(right("create")[0]).toMatchObject({
      index: "foo",
      collection: "bar",
      value: "allowed",
    });
  });

  it("should retrieve its profiles", async () => {
    const profiles = await user.getProfiles();

    expect(profiles).toEqual([profile, profile2]);
    expect(profiles[0]).toBe(profile);
  });

  it("should use the isActionAllowed method from its profile", async () => {
    await expect(user.isActionAllowed(new Request({}))).resolves.toBe(true);

    expect(profile.isActionAllowed).toHaveBeenCalled();
  });

  it("should reject if there is no application to load the profiles from", async () => {
    restoreKuzzle();

    const rejection = user.isActionAllowed(new Request({}));

    await expect(rejection).rejects.toBeInstanceOf(InternalError);
    await expect(rejection).rejects.toMatchObject({
      id: "security.user.uninitialized",
    });
  });

  describe("#isActionAllowed", () => {
    it("should return false if there is no profileIds", async () => {
      user.profileIds = invalid<string[]>(undefined);
      await expect(user.isActionAllowed(new Request({}))).resolves.toBe(false);

      user.profileIds = [];
      await expect(user.isActionAllowed(new Request({}))).resolves.toBe(false);

      expect(profile.isActionAllowed).not.toHaveBeenCalled();
    });

    it("should ask each profile until one allows the action, when the request names no target", async () => {
      const denies = new Profile();
      denies.isActionAllowed = vi.fn(async () => false);
      const allows = new Profile();
      allows.isActionAllowed = vi.fn(async () => true);
      const request = new Request({});

      user.getProfiles = vi.fn(async () => [denies, allows]);

      await expect(user.isActionAllowed(request)).resolves.toBe(true);

      expect(denies.isActionAllowed).toHaveBeenCalledOnce();
      expect(denies.isActionAllowed).toHaveBeenCalledWith(request);
      expect(allows.isActionAllowed).toHaveBeenCalledOnce();
      expect(allows.isActionAllowed).toHaveBeenCalledWith(request);
    });

    it("should decide on the targets' restrictions, not on the profiles, when the request names targets", async () => {
      /*
       * The Mocha spec stubbed `areTargetsAllowed` — a private method — and
       * asserted it had been called. What that stands for is the branch: with
       * targets, `isActionAllowed` no longer asks a profile whether the action
       * is allowed, it asks each role whether the target is.
       */
      const request = new Request({
        targets: [{ index: "index", collections: ["collection"] }],
      });

      await expect(user.isActionAllowed(request)).resolves.toBe(true);

      expect(profile.isActionAllowed).not.toHaveBeenCalled();
      expect(profile2.isActionAllowed).not.toHaveBeenCalled();
      expect(profile.getAllowedPolicies).toHaveBeenCalledOnce();
      expect(profile.getAllowedPolicies).toHaveBeenCalledWith(request);
      expect(profile2.getAllowedPolicies).toHaveBeenCalledOnce();
      expect(profile2.getAllowedPolicies).toHaveBeenCalledWith(request);
    });
  });

  describe("target restrictions", () => {
    /*
     * `areTargetsAllowed` is `private`, and the Mocha spec called it directly.
     * Every one of its cases is reachable through `isActionAllowed` with a
     * request that names targets — which is also the only way the application
     * reaches it.
     */
    const allowed = (targets: unknown[]) =>
      user.isActionAllowed(new Request({ targets }));

    it("should refuse a target whose index or collection carries a wildcard", async () => {
      await expect(
        allowed([{ index: "*", collections: ["foo"] }]),
      ).resolves.toBe(false);
      await expect(
        allowed([{ index: "foo", collections: ["*"] }]),
      ).resolves.toBe(false);
    });

    it("should skip targets with a missing index or collections", async () => {
      await expect(allowed([{ collections: ["foo"] }])).resolves.toBe(true);
      await expect(allowed([{ index: "foo" }])).resolves.toBe(true);

      // Skipped means skipped: no role was asked about them.
      expect(profilePolicies[0].role.checkRestrictions).not.toHaveBeenCalled();
    });

    it("should check the restrictions of every role of every policy of every profile", async () => {
      await expect(
        allowed([
          { index: "foo", collections: ["bar", "baz"] },
          { index: "alpha", collections: ["beta"] },
        ]),
      ).resolves.toBe(true);

      for (const policies of [profilePolicies, profilePolicies2]) {
        for (const { role } of policies) {
          expect(role.checkRestrictions).toHaveBeenNthCalledWith(
            1,
            "foo",
            "bar",
            new Map(),
          );
          expect(role.checkRestrictions).toHaveBeenNthCalledWith(
            2,
            "foo",
            "baz",
            new Map(),
          );
          expect(role.checkRestrictions).toHaveBeenNthCalledWith(
            3,
            "alpha",
            "beta",
            new Map(),
          );
        }
      }
    });
  });
});
