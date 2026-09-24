import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TokenManager } from "../../../lib/core/auth/tokenManager";
import { Token } from "../../../lib/model/security/token";
import { invalid } from "../../helpers/invalid";
import { present } from "../../helpers/present";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

/** One entry of the manager's sorted list, as it keeps them. */
type ManagedToken = {
  _id: string | null;
  idx: string;
  expiresAt: number | null;
  userId: string;
  connectionIds: Set<string>;
};

describe("#core/auth/TokenManager", () => {
  const anonymousToken = new Token({ _id: null, userId: "-1" });

  let manager: TokenManager;
  let token: Token;
  let bus: ReturnType<typeof stubAsk>;
  let listeners: Map<string, (...args: unknown[]) => void>;

  beforeEach(async () => {
    listeners = new Map();
    bus = stubAsk((event: string) => {
      if (event === "core:security:user:anonymous:get") {
        return { _id: "-1" };
      }

      return undefined;
    });

    stubKuzzle({
      ask: bus.ask,
      onAsk: bus.onAsk,
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        listeners.set(event, fn);
      }),
    });

    manager = new TokenManager();
    token = new Token({
      _id: "foo#bar",
      expiresAt: Date.now() + 1000,
      jwt: "bar",
      userId: "foo",
    });

    await manager.init();
  });

  afterEach(() => {
    // The manager schedules its own expiry check; left behind, it keeps the
    // process (and the next file) awake.
    const { timer } = manager as unknown as { timer: NodeJS.Timeout | null };

    if (timer) {
      clearTimeout(timer);
    }

    vi.useRealTimers();
    restoreKuzzle();
  });

  /*
   * The sorted list of managed tokens. It is `private`, and — unlike
   * `tokensByConnection`, which `getConnectedUserToken` answers for — nothing
   * on the public surface reports what is still managed. Element access is
   * TypeScript's own escape hatch, used here once and named.
   */
  const managed = () =>
    (manager as unknown as { tokens: { array: ManagedToken[] } }).tokens.array;

  /**
   * What the manager holds for a connection, through its public reader.
   *
   * `Token.userId` is `string | null` — a token can exist before it is
   * attached to a user — while `getConnectedUserToken` takes a `string`. Every
   * token these tests build has a user, and this is where that is asserted,
   * once, instead of at each of the nine call sites.
   */
  const forConnection = (user: Token | string, connectionId: string) => {
    const userId = typeof user === "string" ? user : user.userId;

    present(userId, "token.userId");

    return manager.getConnectedUserToken(userId, connectionId);
  };

  const entry = (t: Token, connectionIds: string[]) => ({
    idx: `${t.expiresAt};${t._id}`,
    connectionIds: new Set(connectionIds),
    expiresAt: t.expiresAt,
    userId: t.userId,
  });

  describe("#init", () => {
    it('should register a listener on "connection:remove"', async () => {
      const removeConnection = vi.spyOn(manager, "removeConnection");

      listeners.get("connection:remove")?.({ id: "connection-id" });

      expect(removeConnection).toHaveBeenCalledWith("connection-id");
    });
  });

  describe("#link", () => {
    it("should do nothing if the token is not set", () => {
      manager.link(invalid<Token>(null), "foo");

      expect(managed()).toEqual([]);
      expect(forConnection("foo", "foo")).toBeNull();
    });

    it("should not add a link to an anonymous token", () => {
      manager.link(anonymousToken, "foo");

      expect(managed()).toEqual([]);
    });

    it("should create an entry, and start the timer, for a token seen for the first time", () => {
      const runTimer = vi.spyOn(manager, "runTimer");

      manager.link(token, "foo");

      expect(managed()).toMatchObject([entry(token, ["foo"])]);
      expect(forConnection(token, "foo")).toMatchObject(entry(token, ["foo"]));
      expect(runTimer).toHaveBeenCalledOnce();
    });

    it("should add the connection to the existing entry of a known token", () => {
      manager.link(token, "foo");
      manager.link(token, "bar");

      expect(managed()).toMatchObject([entry(token, ["foo", "bar"])]);
      for (const connectionId of ["foo", "bar"]) {
        expect(forConnection(token, connectionId)).toMatchObject(
          entry(token, ["foo", "bar"]),
        );
      }
    });

    it("should not restart the timer for a token that is not the next to expire", () => {
      manager.link(token, "foo");

      const runTimer = vi.spyOn(manager, "runTimer");
      const later = new Token({
        _id: "foo2#bar2",
        userId: "foo2",
        jwt: "bar2",
        expiresAt: Date.now() + 10000,
      });

      manager.link(later, "foo2");

      expect(managed()).toMatchObject([
        entry(token, ["foo"]),
        entry(later, ["foo2"]),
      ]);
      expect(runTimer).not.toHaveBeenCalled();
    });

    it("should move a connection when it is linked to another token", () => {
      const later = new Token({
        _id: "foo2#bar2",
        userId: "foo2",
        jwt: "bar2",
        expiresAt: Date.now() + 10000,
      });

      manager.link(token, "foo1");
      manager.link(token, "foo2");
      expect(forConnection(token, "foo1")).toMatchObject(
        entry(token, ["foo1", "foo2"]),
      );

      manager.link(later, "foo1");

      expect(forConnection(later, "foo1")).toMatchObject(
        entry(later, ["foo1"]),
      );
      expect(managed()).toMatchObject([
        entry(token, ["foo2"]),
        entry(later, ["foo1"]),
      ]);
    });
  });

  describe("#expire", () => {
    it("should drop the entry and close every linked connection", async () => {
      manager.link(token, "foo");
      manager.link(token, "bar");

      await manager.expire(token);

      expect(managed()).toEqual([]);
      for (const connectionId of ["foo", "bar"]) {
        expect(bus.ask).toHaveBeenCalledWith(
          "core:realtime:connection:remove",
          connectionId,
        );
        expect(forConnection(token, connectionId)).toBeNull();
      }
    });

    it("should do nothing for a token of the anonymous user", async () => {
      manager.link(token, "foo");

      await manager.expire(anonymousToken);

      expect(managed()).toHaveLength(1);
    });

    it("should do nothing for a token that was never registered", async () => {
      manager.link(token, "foo");

      await manager.expire(
        new Token({
          _id: "foo2#bar2",
          userId: "foo2",
          jwt: "bar2",
          expiresAt: Date.now() + 1000,
        }),
      );

      expect(managed()).toHaveLength(1);
    });
  });

  describe("#checkTokensValidity", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    /*
     * Stubbed, as the Mocha spec did, and before the links: the real one
     * reschedules itself, so running the pending timers would run the loop
     * until vitest calls it infinite.
     */
    const stubRunTimer = () =>
      vi.spyOn(manager, "runTimer").mockImplementation(() => {});

    /** The connections the manager told realtime were expired. */
    const notified = () =>
      bus.ask.mock.calls
        .filter(([event]) => event === "core:realtime:tokenExpired:notify")
        .map(([, connectionId]) => connectionId);

    it("should do nothing if no token has expired", async () => {
      const expiresAt = Date.now() + 1000000;
      const runTimer = stubRunTimer();

      manager.link(new Token({ _id: "bar", expiresAt }), "connectionId1");
      manager.link(new Token({ _id: "foo", expiresAt }), "connectionId2");
      runTimer.mockClear();

      await manager.checkTokensValidity();

      expect(notified()).toEqual([]);
      expect(managed()).toHaveLength(2);
      expect(runTimer).toHaveBeenCalledOnce();
    });

    it("should clean up the subscriptions of an expired token", async () => {
      const now = Date.now();
      const runTimer = stubRunTimer();

      manager.link(
        new Token({ _id: "bar", expiresAt: now + 1000000, userId: "kept" }),
        "connectionId1",
      );
      manager.link(
        new Token({ _id: "foo", expiresAt: now - 1000, userId: "expired" }),
        "connectionId2",
      );
      runTimer.mockClear();

      await manager.checkTokensValidity();
      await vi.runAllTimersAsync();

      expect(notified()).toEqual(["connectionId2"]);
      expect(managed()).toHaveLength(1);
      expect(managed()[0]?._id).toBe("bar");
      expect(runTimer).toHaveBeenCalledOnce();
      expect(forConnection("kept", "connectionId1")).not.toBeNull();
      expect(forConnection("expired", "connectionId2")).toBeNull();
    });

    it("should never expire an API key", async () => {
      const runTimer = stubRunTimer();

      manager.link(
        new Token({ _id: "api-key-1", expiresAt: -1 }),
        "connectionId1",
      );
      runTimer.mockClear();

      await manager.checkTokensValidity();
      await vi.runAllTimersAsync();

      expect(notified()).toEqual([]);
      expect(managed()).toHaveLength(1);
      expect(managed()[0]?._id).toBe("api-key-1");
      expect(runTimer).toHaveBeenCalledOnce();
    });

    it("should not rerun a timer once the last token is gone", async () => {
      const runTimer = stubRunTimer();

      manager.link(
        new Token({ _id: "foo", expiresAt: Date.now() - 1000 }),
        "connectionId2",
      );
      runTimer.mockClear();

      await manager.checkTokensValidity();
      await vi.runAllTimersAsync();

      expect(managed()).toEqual([]);
      expect(runTimer).not.toHaveBeenCalled();
    });
  });

  describe("#unlink", () => {
    it("should not unlink an anonymous token", () => {
      manager.link(token, "foo");

      manager.unlink(anonymousToken, "foo");

      expect(managed()).toHaveLength(1);
    });

    it("should not unlink a token it does not manage", () => {
      manager.link(token, "foo");

      manager.unlink(new Token({ _id: "i am the beyonder" }), "bar");

      expect(managed()).toHaveLength(1);
    });

    it("should remove only the connection it is given", () => {
      for (const connectionId of ["foo", "bar", "baz"]) {
        manager.link(token, connectionId);
      }

      manager.unlink(token, "bar");

      expect(managed()).toMatchObject([entry(token, ["foo", "baz"])]);
    });

    it("should drop the entry once its last connection is removed", () => {
      for (const connectionId of ["foo", "bar", "baz"]) {
        manager.link(token, connectionId);
      }

      for (const connectionId of ["bar", "foo", "baz"]) {
        manager.unlink(token, connectionId);
      }

      expect(managed()).toEqual([]);
      expect(forConnection(token, "foo")).toBeNull();
    });
  });

  describe("#removeConnection", () => {
    it("should unlink the connection without expiring its token", async () => {
      const expire = vi.spyOn(manager, "expire");
      manager.link(token, "connectionId");

      await manager.removeConnection("connectionId");

      expect(expire).not.toHaveBeenCalled();
      expect(managed()).toEqual([]);
      expect(forConnection(token, "connectionId")).toBeNull();
      // Unlinking is not expiring: the realtime layer is not told to drop it.
      expect(bus.ask).not.toHaveBeenCalledWith(
        "core:realtime:connection:remove",
        "connectionId",
      );
    });

    it("should do nothing for a connection it holds no token for", async () => {
      await expect(
        manager.removeConnection("unknown"),
      ).resolves.toBeUndefined();
    });
  });

  describe("#refresh", () => {
    beforeEach(() => {
      manager.link(token, "foo");
    });

    it("should do nothing if the provided token is not linked", () => {
      manager.refresh(
        new Token({ _id: "i am the beyonder" }),
        new Token({ _id: "i am the mountain" }),
      );

      expect(managed()).toHaveLength(1);
      expect(managed()[0]?.idx).toBe(`${token.expiresAt};${token._id}`);
    });

    it("should replace the old token with the new one", () => {
      // `userId`, which the fixture did not carry: a refresh keeps the user
      // and `getConnectedUserToken` answers only when the stored token's user
      // matches the one asked for. Without it both sides were `null`, so the
      // lookup matched without ever checking the association it exists to
      // check (step 14, M6).
      const refreshed = new Token({ _id: "...I got better", userId: "foo" });

      manager.refresh(token, refreshed);

      expect(managed()).toHaveLength(1);
      expect(managed()[0]?.idx).toBe(`${refreshed.expiresAt};${refreshed._id}`);
      expect(forConnection(refreshed, "foo")).toMatchObject({
        idx: `${refreshed.expiresAt};${refreshed._id}`,
      });
    });
  });

  describe("#getConnectedUserToken", () => {
    it("should return a matching token", () => {
      manager.link(token, "foo");

      expect(manager.getConnectedUserToken(token.userId, "foo")).toMatchObject({
        _id: token._id,
        expiresAt: token.expiresAt,
        userId: token.userId,
        jwt: token.jwt,
        connectionIds: new Set(["foo"]),
      });
    });

    it("should not return a token the connection is not associated with", () => {
      manager.link(token, "foo");
      manager.link(new Token({ _id: "New Token" }), "bar");

      expect(manager.getConnectedUserToken(token.userId, "bar")).toBeNull();
    });
  });
});
