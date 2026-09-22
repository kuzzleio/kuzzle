import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RateLimiter from "../../lib/api/rateLimiter";
import { KuzzleRequest } from "../../lib/api/request";
import { invalid } from "../helpers/invalid";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../mocks/kuzzle";

describe("#api/RateLimiter", () => {
  const mGetProfiles = "core:security:profile:mGet";

  let limiter: RateLimiter;
  let request: KuzzleRequest;
  let profiles: Array<{ _id: string; rateLimit: number }>;
  let bus: ReturnType<typeof stubAsk>;

  beforeEach(() => {
    profiles = [
      { _id: "bar", rateLimit: 50 },
      { _id: "baz", rateLimit: 200 },
    ];

    bus = stubAsk((event: string) => {
      if (event === mGetProfiles) {
        return profiles;
      }

      return undefined;
    });

    stubKuzzle({
      ask: bus.ask,
      onAsk: bus.onAsk,
      config: { limits: { loginsPerSecond: 1 } },
    });

    vi.useFakeTimers();

    limiter = new RateLimiter();
    request = new KuzzleRequest(
      {},
      {
        user: { _id: "foo", profileIds: ["bar", "baz"] },
        connection: { id: "qux" },
      },
    );
  });

  afterEach(() => {
    clearInterval(internals().frameResetTimer as NodeJS.Timeout);
    vi.useRealTimers();
    restoreKuzzle();
  });

  /*
   * `frame` and `frameResetTimer` are `private`, and the limiter's whole
   * contract is about what the frame counts — nothing on the public surface
   * reports it. Named once here rather than cast at each call site.
   */
  const internals = () =>
    limiter as unknown as {
      frame: Record<string, number | undefined>;
      frameResetTimer: NodeJS.Timeout | null;
    };

  /** The number of times the profiles were asked for. */
  const profileLookups = () =>
    bus.ask.mock.calls.filter(([event]) => event === mGetProfiles).length;

  describe("#init", () => {
    it("should clear the frame every second", () => {
      expect(internals().frame).toEqual({});
      expect(internals().frameResetTimer).toBeNull();

      limiter.init();
      expect(internals().frameResetTimer).not.toBeNull();

      internals().frame.foo = 1;
      vi.advanceTimersByTime(1000);

      expect(internals().frame).toEqual({});
    });
  });

  describe("#isAllowed", () => {
    beforeEach(() => {
      limiter.init();
    });

    it("should limit auth:login per connection, not per user", async () => {
      request.input.controller = "auth";
      request.input.action = "login";
      request.context.connection.id = "foobar";

      await expect(limiter.isAllowed(request)).resolves.toBe(true);
      expect(internals().frame.foobar).toBe(1);

      await expect(limiter.isAllowed(request)).resolves.toBe(false);
      expect(internals().frame.foobar).toBe(2);

      // Another connection has its own budget.
      request.context.connection.id = "barfoo";
      await expect(limiter.isAllowed(request)).resolves.toBe(true);
      expect(internals().frame.barfoo).toBe(1);
      expect(internals().frame.foobar).toBe(2);

      vi.advanceTimersByTime(1000);

      request.context.connection.id = "foobar";
      await expect(limiter.isAllowed(request)).resolves.toBe(true);
      expect(internals().frame.foobar).toBe(1);

      // The login limit is configuration, never a profile.
      expect(profileLookups()).toBe(0);
    });

    it("should limit other requests by the most permissive profile", async () => {
      request.input.controller = "controller";
      request.input.action = "action";

      for (let i = 0; i < 200; i++) {
        await expect(limiter.isAllowed(request)).resolves.toBe(true);
        expect(internals().frame.foo).toBe(i + 1);
      }

      await expect(limiter.isAllowed(request)).resolves.toBe(false);
      expect(internals().frame.foo).toBe(201);
      expect(profileLookups()).toBe(201);
      expect(bus.ask).toHaveBeenCalledWith(mGetProfiles, ["bar", "baz"]);

      vi.advanceTimersByTime(1000);
      await expect(limiter.isAllowed(request)).resolves.toBe(true);
      expect(internals().frame.foo).toBe(1);
    });

    it("should not limit at all if one profile carries no rate limit", async () => {
      profiles.push({ _id: "over9000", rateLimit: 0 });
      request.input.controller = "controller";
      request.input.action = "action";

      for (let i = 0; i < 9001; i++) {
        await expect(limiter.isAllowed(request)).resolves.toBe(true);
        expect(internals().frame.foo).toBeUndefined();
      }

      expect(profileLookups()).toBe(9001);
    });

    it("should not limit auth:logout for an authenticated user", async () => {
      request.input.controller = "auth";
      request.input.action = "logout";
      profiles = [{ _id: "bar", rateLimit: 1 }];

      for (let i = 0; i < 50; i++) {
        await expect(limiter.isAllowed(request)).resolves.toBe(true);
        expect(internals().frame.foo).toBeUndefined();
      }

      expect(profileLookups()).toBe(0);
    });

    it("should limit auth:logout for the anonymous user", async () => {
      request.context.user._id = "-1";
      request.input.controller = "auth";
      request.input.action = "logout";
      profiles = [{ _id: "bar", rateLimit: 50 }];

      for (let i = 0; i < 50; i++) {
        await expect(limiter.isAllowed(request)).resolves.toBe(true);
        expect(internals().frame["-1"]).toBe(i + 1);
      }

      await expect(limiter.isAllowed(request)).resolves.toBe(false);
      expect(internals().frame["-1"]).toBe(51);
      expect(profileLookups()).toBe(51);

      vi.advanceTimersByTime(1000);
      await expect(limiter.isAllowed(request)).resolves.toBe(true);
      expect(internals().frame["-1"]).toBe(1);
    });

    // The profile's rateLimit is the only thing this branch reads, and there is
    // no profile without a user. Falling through left `limit` at -1 and denied
    // the request, which is not what "no limit applies" means.
    it("should allow a request that carries no user", async () => {
      request.context.user = invalid<KuzzleRequest["context"]["user"]>(null);

      await expect(limiter.isAllowed(request)).resolves.toBe(true);
      expect(profileLookups()).toBe(0);
    });

    // An internal request has no connection id. It has always been counted
    // under the stringified null, and still is: the limit is not lifted for
    // whoever can reach auth:login without one.
    it("should count logins with no connection id under a single bucket", async () => {
      request.context.connection.id = null;
      request.input.controller = "auth";
      request.input.action = "login";

      await expect(limiter.isAllowed(request)).resolves.toBe(true);
      expect(internals().frame.null).toBe(1);
    });
  });
});
