import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Funnel from "../../../lib/api/funnel";
import { KuzzleRequest } from "../../../lib/api/request";
import { ForbiddenError } from "../../../lib/kerror/errors/forbiddenError";
import { UnauthorizedError } from "../../../lib/kerror/errors/unauthorizedError";
import { Token } from "../../../lib/model/security/token";
import { User } from "../../../lib/model/security/user";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/funnel.checkRights", () => {
  const verifyTokenEvent = "core:security:token:verify";
  const getUserEvent = "core:security:user:get";

  let funnel: Funnel;
  let request: KuzzleRequest;
  let user: User;
  let token: Token;
  let ask: ReturnType<typeof vi.fn>;
  let pipe: ReturnType<typeof vi.fn>;
  let link: ReturnType<typeof vi.fn>;
  let failures: Map<string, Error>;

  beforeEach(() => {
    user = new User();
    user._id = "foo";
    user.profileIds = ["default"];
    Object.assign(user, { _source: { bar: "qux" } });

    token = new Token({
      _id: "token",
      expiresAt: 123,
      jwt: "hash",
      refreshed: false,
      ttl: 456,
      userId: user._id,
    });

    failures = new Map();
    link = vi.fn();
    pipe = vi.fn(async (event: string, payload: unknown) => payload);

    ask = vi.fn(async (event: string) => {
      const failure = failures.get(event);

      if (failure) {
        throw failure;
      }

      if (event === verifyTokenEvent) {
        return token;
      }

      if (event === getUserEvent) {
        return user;
      }

      return undefined;
    });

    stubKuzzle({
      ask,
      pipe,
      tokenManager: { link },
      pluginsManager: { getStrategyMethod: () => undefined },
      config: {
        http: { cookieAuthentication: false, routes: [] },
        internal: { notifiableProtocols: ["websocket", "mqtt"] },
        limits: { loginsPerSecond: 1 },
        plugins: { common: { failsafeMode: false } },
        security: { restrictedProfileIds: [], standard: {} },
        version: "2.56.0",
      },
    });

    funnel = new Funnel();
    request = new KuzzleRequest({
      controller: "document",
      action: "get",
      jwt: "hashed JWT",
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** Whether the funnel piped that event with this request. */
  const piped = (event: string) =>
    pipe.mock.calls.some(
      ([name, payload]) => name === event && payload === request,
    );

  const allow = (allowed: boolean) =>
    vi.spyOn(user, "isActionAllowed").mockResolvedValue(allowed);

  it("should link the token to the connection for realtime protocols", async () => {
    allow(true);
    request.context.connection.id = "connection-id";
    request.context.connection.protocol = "websocket";

    await funnel.checkRights(request);

    expect(link).toHaveBeenCalledWith(request.context.token, "connection-id");
  });

  it("should resolve, and notify, when the rights are correct", async () => {
    allow(true);

    await funnel.checkRights(request);

    expect(ask).toHaveBeenCalledWith(verifyTokenEvent, "hashed JWT");
    expect(ask).toHaveBeenCalledWith(getUserEvent, user._id);
    expect(piped("request:onAuthorized")).toBe(true);
    expect(piped("request:onUnauthorized")).toBe(false);
    // Nothing to link: this request carries no realtime connection.
    expect(link).not.toHaveBeenCalled();
  });

  it("should reject an anonymous user with an UnauthorizedError", async () => {
    token.userId = "-1";
    allow(false);

    const rejection = funnel.checkRights(request);

    await expect(rejection).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(rejection).rejects.toMatchObject({
      id: "security.rights.unauthorized",
    });

    expect(ask).toHaveBeenCalledWith(getUserEvent, "-1");
    expect(piped("request:onAuthorized")).toBe(false);
    expect(piped("request:onUnauthorized")).toBe(true);
  });

  it("should reject an authenticated user with a ForbiddenError", async () => {
    allow(false);

    const rejection = funnel.checkRights(request);

    await expect(rejection).rejects.toBeInstanceOf(ForbiddenError);
    await expect(rejection).rejects.toMatchObject({
      id: "security.rights.forbidden",
    });

    expect(piped("request:onAuthorized")).toBe(false);
    expect(piped("request:onUnauthorized")).toBe(true);
  });

  it("should forward a token:verify exception, and notify", async () => {
    const error = new Error("foo");
    failures.set(verifyTokenEvent, error);

    await expect(funnel.checkRights(request)).rejects.toBe(error);

    /*
     * The Mocha spec wrote `should(getUserEvent).not.called()` — on the event's
     * NAME, a string. This asserts what it meant: the user is never loaded
     * when the token cannot be verified.
     */
    expect(ask).not.toHaveBeenCalledWith(getUserEvent, expect.anything());
    expect(piped("request:onAuthorized")).toBe(false);
    expect(piped("request:onUnauthorized")).toBe(true);
  });

  it("should forward a user:get exception, and notify nothing", async () => {
    const error = new Error("foo");
    failures.set(getUserEvent, error);

    await expect(funnel.checkRights(request)).rejects.toBe(error);

    expect(piped("request:onAuthorized")).toBe(false);
    expect(piped("request:onUnauthorized")).toBe(false);
  });

  describe("failsafe mode", () => {
    beforeEach(() => {
      global.kuzzle.config.plugins.common.failsafeMode = true;
      allow(true);
    });

    it("should reject a non-admin user", async () => {
      await expect(funnel.checkRights(request)).rejects.toMatchObject({
        id: "security.rights.failsafe_mode_admin_only",
      });

      expect(piped("request:onAuthorized")).toBe(false);
      expect(piped("request:onUnauthorized")).toBe(true);
    });

    it("should let an admin user through", async () => {
      user.profileIds = ["admin"];

      await funnel.checkRights(request);

      expect(piped("request:onAuthorized")).toBe(true);
      expect(piped("request:onUnauthorized")).toBe(false);
    });
  });

  describe("cookie authentication", () => {
    /*
     * Four inputs decide this: the `cookieAuthentication` setting, the
     * `cookieAuth` argument, whether a jwt is present, and whether a Kuzzle
     * cookie is. The Mocha spec spelled out eleven combinations, each in its
     * own `it` with the whole matrix in the title.
     */
    const check = async ({
      cookieAuthentication,
      cookieAuth,
      jwt,
      cookie,
    }: {
      cookieAuthentication: boolean;
      cookieAuth: boolean;
      jwt: string | null;
      cookie?: string;
    }) => {
      global.kuzzle.config.http.cookieAuthentication = cookieAuthentication;
      request.input.jwt = jwt;
      request.input.args.cookieAuth = cookieAuth;

      if (cookie !== undefined) {
        request.input.headers = { cookie };
      }

      allow(true);

      return funnel.checkRights(request);
    };

    it.each([
      // cookie authentication on: the cookie is read when there is no jwt
      [true, true, null, "authToken=hashed JWT;"],
      [true, false, null, "authToken=hashed JWT;"],
      // …and the jwt is kept when there is no Kuzzle cookie
      [true, true, "hashed JWT", undefined],
      [true, true, "hashed JWT", "randomToken=foobar;"],
      [true, true, "hashed JWT", "authToken=null;"],
      [true, false, "hashed JWT", undefined],
      // cookie authentication off: the jwt is the only source
      [false, false, "hashed JWT", undefined],
      [false, false, "hashed JWT", "randomToken=foobar;"],
    ] as const)(
      "should end up with the jwt (cookieAuthentication=%s, cookieAuth=%s, jwt=%s, cookie=%s)",
      async (cookieAuthentication, cookieAuth, jwt, cookie) => {
        await check({ cookieAuthentication, cookieAuth, jwt, cookie });

        expect(request.input.jwt).toBe("hashed JWT");
      },
    );

    it.each([
      // a Kuzzle cookie AND a jwt is ambiguous, whichever way cookieAuth is set
      [true, true, "hashed JWT", "authToken=foobar; randomToken=test"],
      [true, false, "hashed JWT", "authToken=foobar;"],
    ] as const)(
      "should refuse both a cookie and a token (cookieAuth=%s)",
      async (cookieAuthentication, cookieAuth, jwt, cookie) => {
        await expect(
          check({ cookieAuthentication, cookieAuth, jwt, cookie }),
        ).rejects.toMatchObject({ id: "security.token.verification_error" });
      },
    );

    it.each([
      // cookie authentication off: a Kuzzle cookie is unsupported, full stop
      [false, true, null, "authToken=foobar;"],
      [false, false, "hashed JWT", "authToken=foobar;"],
      [false, false, null, "authToken=foobar;"],
    ] as const)(
      "should refuse a Kuzzle cookie when cookie authentication is off (cookieAuth=%s, jwt=%s)",
      async (cookieAuthentication, cookieAuth, jwt, cookie) => {
        await expect(
          check({ cookieAuthentication, cookieAuth, jwt, cookie }),
        ).rejects.toMatchObject({ id: "security.cookie.unsupported" });
      },
    );
  });
});
