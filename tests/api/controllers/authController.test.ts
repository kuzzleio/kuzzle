import jwt from "jsonwebtoken";
import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AuthController from "../../../lib/api/controllers/authController";
import { NativeController } from "../../../lib/api/controllers/baseController";
import { Request } from "../../../lib/api/request/kuzzleRequest";
import { loadConfig } from "../../../lib/config";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import { UnauthorizedError } from "../../../lib/kerror/errors/unauthorizedError";
import { Token } from "../../../lib/model/security/token";
import { User } from "../../../lib/model/security/user";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";
import { bodyOf, userOf } from "../../helpers/request";

/** The cookie every `cookieAuth` path writes, with its token interpolated. */
const setCookie = (token: string) =>
  new RegExp(
    `^authToken=${token}; Path=/; Expires=[^;]+; HttpOnly; SameSite=Strict$`,
  );

describe("#api/controllers/authController", () => {
  let controller: AuthController;
  let request: Request;
  let cookieRequest: Request;
  let user: User;
  let config: ReturnType<typeof loadConfig>;

  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let failures: Map<string, Error>;
  let pipe: ReturnType<typeof vi.fn>;
  let pipes: Record<string, unknown>;
  let authenticate: ReturnType<typeof vi.fn>;
  let tokenManager: Record<string, ReturnType<typeof vi.fn>>;
  let pluginsManager: {
    getStrategyMethod: ReturnType<typeof vi.fn>;
    hasStrategyMethod: ReturnType<typeof vi.fn>;
    listStrategies: ReturnType<typeof vi.fn>;
    strategies: JSONObject;
  };

  beforeEach(async () => {
    answers = { "core:security:user:anonymous:get": { _id: "-1" } };
    failures = new Map();

    ask = vi.fn(async (event: string, ...args: unknown[]) => {
      const failure = failures.get(event);

      if (failure) {
        throw failure;
      }

      const answer = answers[event];

      return typeof answer === "function" ? answer(...args) : answer;
    });

    /* `pipe(event, payload)` answers the payload unless a test says otherwise —
     * `login` reads the result back, so a promise-of-undefined stub would make
     * every authentication fail on a property of `undefined`. */
    pipes = {};
    pipe = vi.fn(async (event: string, payload: unknown) =>
      event in pipes ? pipes[event] : payload,
    );

    user = new User();
    authenticate = vi.fn(async () => user);

    tokenManager = {
      getConnectedUserToken: vi.fn(async () => null),
      link: vi.fn(),
      refresh: vi.fn(),
      unlink: vi.fn(),
    };

    pluginsManager = {
      getStrategyMethod: vi.fn(),
      hasStrategyMethod: vi.fn(() => false),
      listStrategies: vi.fn(() => [] as string[]),
      strategies: { mockup: {} },
    };

    /* The shipped config, deep-cloned: `loadConfig()` answers a shared object
     * and these tests pin `cookieAuthentication` and the jwt secret. */
    config = JSON.parse(JSON.stringify(loadConfig()));
    config.security.jwt!.secret = "test-secret";
    config.http.cookieAuthentication = false;

    stubKuzzle({
      ask,
      config,
      id: "knode-test",
      log: stubLogger(),
      passport: { authenticate },
      pipe,
      pluginsManager,
      tokenManager,
    });

    request = new Request({
      action: "login",
      body: { username: "jdoe" },
      controller: "auth",
      foo: "bar",
      strategy: "mockup",
    });

    cookieRequest = new Request({
      action: "login",
      body: { username: "jdoe" },
      controller: "auth",
      cookieAuth: true,
      foo: "bar",
      strategy: "mockup",
    });
    cookieRequest.input.headers = { cookie: "authToken=;" };

    controller = new AuthController();

    await controller.init();
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  const asked = (event: string) =>
    ask.mock.calls.filter(([name]) => name === event);

  const rejects = async (
    promise: Promise<unknown>,
    match: JSONObject,
    error:
      | typeof BadRequestError
      | typeof InternalError
      | typeof PluginImplementationError
      | typeof UnauthorizedError = BadRequestError,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(error);
    await expect(promise).rejects.toMatchObject(match);
  };

  /** A token as `core:security:token:create` answers one. */
  const tokenOf = (overrides: JSONObject = {}) =>
    new Token(
      invalid({
        _id: "foobar#bar",
        expiresAt: 4567,
        jwt: "bar",
        ttl: 1234,
        userId: "foobar",
        ...overrides,
      }),
    );

  const cookiesOf = (req: Request) =>
    invalid<Record<string, string[]>>(req.response.headers)["Set-Cookie"];

  describe("#constructor", () => {
    it("should inherit the base constructor", () => {
      expect(controller).toBeInstanceOf(NativeController);
    });
  });

  describe("#checkRights", () => {
    let isActionAllowed: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      isActionAllowed = vi.fn(async () => true);

      request.context.user = invalid({ isActionAllowed });
      request.input.body = { action: "create", controller: "document" };
    });

    it("should check if the action is allowed for the user", async () => {
      await expect(controller.checkRights(request)).resolves.toEqual({
        allowed: true,
      });

      expect(isActionAllowed).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            action: "create",
            controller: "document",
          }),
        }),
      );
    });

    it("should reject if the provided request is not valid", async () => {
      bodyOf(request).controller = null;

      await rejects(controller.checkRights(request), {
        id: "api.assert.missing_argument",
      });

      bodyOf(request).controller = "document";
      bodyOf(request).action = null;

      await rejects(controller.checkRights(request), {
        id: "api.assert.missing_argument",
      });
    });
  });

  /*
   * `#login` and `#login with cookies` share their setup and their cases but
   * not their assertions: the cookie half answers a token-less body and writes
   * a `Set-Cookie` header instead. Kept as two blocks, as they were.
   */
  describe("#login", () => {
    const createEvent = "core:security:token:create";

    it("should resolve to a valid jwt token if authentication succeed", async () => {
      answers[createEvent] = tokenOf();

      await expect(controller.login(request)).resolves.toMatchObject({
        _id: "foobar",
        expiresAt: 4567,
        jwt: "bar",
        ttl: 1234,
      });

      expect(pipe).toHaveBeenCalledWith("auth:strategyAuthenticated", {
        content: user,
        strategy: "mockup",
      });
      expect(asked(createEvent)).toHaveLength(1);
    });

    it("should refresh the token if it already exists", async () => {
      const existing = tokenOf({ _id: "foobar#foo", jwt: "foo" });
      const token = tokenOf();

      answers[createEvent] = token;
      tokenManager.getConnectedUserToken.mockReturnValue(existing);

      await controller.login(request);

      expect(tokenManager.getConnectedUserToken).toHaveBeenCalled();
      expect(tokenManager.refresh).toHaveBeenCalledWith(existing, token);
    });

    it("should send back the same token if it already exists and it is an API Key", async () => {
      const existing = tokenOf({ _id: "foobar#foo", jwt: "kapikey-foo" });

      answers[createEvent] = tokenOf();
      tokenManager.getConnectedUserToken.mockReturnValue(existing);

      await expect(controller.login(request)).resolves.toMatchObject({
        _id: "foobar",
        expiresAt: 4567,
        jwt: "kapikey-foo",
        ttl: 1234,
      });

      expect(tokenManager.getConnectedUserToken).toHaveBeenCalled();
      expect(tokenManager.refresh).not.toHaveBeenCalled();
    });

    it("should send back the same token if it already exists and it has an infinite TTL", async () => {
      const existing = tokenOf({
        _id: "foobar#foo",
        expiresAt: -1,
        jwt: "foo",
        ttl: -1,
      });

      answers[createEvent] = tokenOf();
      tokenManager.getConnectedUserToken.mockReturnValue(existing);

      await expect(controller.login(request)).resolves.toMatchObject({
        _id: "foobar",
        expiresAt: -1,
        jwt: "foo",
        ttl: -1,
      });

      expect(tokenManager.getConnectedUserToken).toHaveBeenCalled();
      expect(tokenManager.refresh).not.toHaveBeenCalled();
    });

    it("should modify the result according to auth:strategyAuthenticated pipe events", async () => {
      pipes["auth:strategyAuthenticated"] = {
        content: { foo: "bar" },
        strategy: "foobar",
      };

      await expect(controller.login(request)).resolves.toMatchObject({
        foo: "bar",
      });

      expect(pipe).toHaveBeenCalledWith("auth:strategyAuthenticated", {
        content: user,
        strategy: "mockup",
      });
      expect(asked(createEvent)).toHaveLength(0);
    });

    it("should handle strategy's headers and status code in case of multi-step authentication strategy", async () => {
      authenticate.mockResolvedValue({
        headers: { Location: "http://github.com" },
        statusCode: 302,
      });

      const response = invalid<JSONObject>(await controller.login(request));

      expect(pipe).not.toHaveBeenCalled();
      expect(response.headers.Location).toBe("http://github.com");
      expect(response.statusCode).toBe(302);
      expect(request.status).toBe(302);
      expect(request.response).toMatchObject({
        headers: { Location: "http://github.com" },
        status: 302,
      });

      expect(asked(createEvent)).toHaveLength(0);
    });

    it("should call passport.authenticate with input body and query string", async () => {
      answers[createEvent] = tokenOf();

      await controller.login(request);

      expect(authenticate).toHaveBeenCalledOnce();
      expect(authenticate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { username: "jdoe" },
          query: expect.objectContaining({ foo: "bar" }),
        }),
        "mockup",
      );
    });

    it("should reject if no strategy is specified", async () => {
      delete request.input.args.strategy;

      await rejects(controller.login(request), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "strategy".',
      });
    });

    it("should be able to set authentication expiration", async () => {
      answers[createEvent] = tokenOf();
      request.input.args.expiresIn = "1s";

      await expect(controller.login(request)).resolves.toMatchObject({
        _id: "foobar",
        expiresAt: 4567,
        jwt: "bar",
        ttl: 1234,
      });

      expect(ask).toHaveBeenCalledWith(createEvent, user, {
        expiresIn: "1s",
      });
    });

    it("should reject if authentication fails", async () => {
      // The Mocha spec was `should(...).be.rejected()` — that it rejects, not
      // with what. TD-57's rule refuses the same shape here, and the answer is
      // that `login` forwards the strategy's error untouched.
      const error = new Error("error");

      authenticate.mockRejectedValue(error);

      await expect(controller.login(request)).rejects.toBe(error);
    });

    it("should reject in case of unknown strategy", async () => {
      request.input.args.strategy = "foobar";

      await rejects(controller.login(request), {
        id: "security.credentials.unknown_strategy",
      });
    });
  });

  describe("#login with cookies", () => {
    const createEvent = "core:security:token:create";

    beforeEach(() => {
      config.http.cookieAuthentication = true;
    });

    it("should resolve to a valid jwt token in the header if authentication succeed ", async () => {
      answers[createEvent] = tokenOf();

      await expect(controller.login(cookieRequest)).resolves.toEqual({
        _id: "foobar",
        expiresAt: 4567,
        ttl: 1234,
      });

      expect(pipe).toHaveBeenCalledWith("auth:strategyAuthenticated", {
        content: user,
        strategy: "mockup",
      });
      expect(cookiesOf(cookieRequest)).toEqual([
        expect.stringMatching(setCookie("bar")),
      ]);
      expect(asked(createEvent)).toHaveLength(1);
    });

    it("should refresh the token if it already exists", async () => {
      const existing = tokenOf({ _id: "foobar#foo", jwt: "foo" });
      const token = tokenOf();

      answers[createEvent] = token;
      tokenManager.getConnectedUserToken.mockReturnValue(existing);

      await expect(controller.login(cookieRequest)).resolves.toEqual({
        _id: "foobar",
        expiresAt: 4567,
        ttl: 1234,
      });

      expect(tokenManager.getConnectedUserToken).toHaveBeenCalled();
      expect(tokenManager.refresh).toHaveBeenCalledWith(existing, token);
      expect(cookiesOf(cookieRequest)).toEqual([
        expect.stringMatching(setCookie("bar")),
      ]);
    });

    it("should send back the same token if it is an API Key and not refresh it", async () => {
      const existing = tokenOf({ _id: "foobar#foo", jwt: "kapikey-foo" });

      answers[createEvent] = tokenOf();
      tokenManager.getConnectedUserToken.mockReturnValue(existing);

      await expect(controller.login(cookieRequest)).resolves.toEqual({
        _id: "foobar",
        expiresAt: 4567,
        ttl: 1234,
      });

      expect(tokenManager.getConnectedUserToken).toHaveBeenCalled();
      expect(tokenManager.refresh).not.toHaveBeenCalled();
      expect(cookiesOf(cookieRequest)).toEqual([
        expect.stringMatching(setCookie("kapikey-foo")),
      ]);
    });

    it("should send back the same token if it has an infinite TTL and not refresh it", async () => {
      const existing = tokenOf({
        _id: "foobar#foo",
        expiresAt: -1,
        jwt: "foo",
        ttl: -1,
      });

      answers[createEvent] = tokenOf();
      tokenManager.getConnectedUserToken.mockReturnValue(existing);

      await expect(controller.login(cookieRequest)).resolves.toEqual({
        _id: "foobar",
        expiresAt: -1,
        ttl: -1,
      });

      expect(tokenManager.getConnectedUserToken).toHaveBeenCalled();
      expect(tokenManager.refresh).not.toHaveBeenCalled();
      expect(cookiesOf(cookieRequest)).toEqual([
        expect.stringMatching(setCookie("foo")),
      ]);
    });

    it("should modify the result according to auth:strategyAuthenticated pipe events", async () => {
      pipes["auth:strategyAuthenticated"] = {
        content: { foo: "bar" },
        strategy: "foobar",
      };

      await expect(controller.login(cookieRequest)).resolves.toMatchObject({
        foo: "bar",
      });

      expect(pipe).toHaveBeenCalledWith("auth:strategyAuthenticated", {
        content: user,
        strategy: "mockup",
      });
      expect(asked(createEvent)).toHaveLength(0);
    });

    it("should handle strategy's headers and status code in case of multi-step authentication strategy", async () => {
      authenticate.mockResolvedValue({
        headers: { Location: "http://github.com" },
        statusCode: 302,
      });

      const response = invalid<JSONObject>(
        await controller.login(cookieRequest),
      );

      expect(pipe).not.toHaveBeenCalled();
      expect(response.headers.Location).toBe("http://github.com");
      expect(response.statusCode).toBe(302);
      expect(cookieRequest.status).toBe(302);
      expect(cookieRequest.response).toMatchObject({
        headers: { Location: "http://github.com" },
        status: 302,
      });

      expect(asked(createEvent)).toHaveLength(0);
    });

    it("should call passport.authenticate with input body and query string", async () => {
      // A full token: this one is written into a Set-Cookie header, which
      // needs both a jwt and an expiry.
      answers[createEvent] = tokenOf();

      await controller.login(cookieRequest);

      expect(authenticate).toHaveBeenCalledOnce();
      expect(authenticate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { username: "jdoe" },
          query: expect.objectContaining({ foo: "bar" }),
        }),
        "mockup",
      );
    });

    it("should reject if no strategy is specified", async () => {
      delete cookieRequest.input.args.strategy;

      await rejects(controller.login(cookieRequest), {
        id: "api.assert.missing_argument",
        message: 'Missing argument "strategy".',
      });
    });

    it("should be able to set authentication expiration", async () => {
      answers[createEvent] = tokenOf();
      cookieRequest.input.args.expiresIn = "1s";

      await expect(controller.login(cookieRequest)).resolves.toEqual({
        _id: "foobar",
        expiresAt: 4567,
        ttl: 1234,
      });

      expect(cookiesOf(cookieRequest)).toEqual([
        expect.stringMatching(setCookie("bar")),
      ]);
      expect(ask).toHaveBeenCalledWith(createEvent, user, { expiresIn: "1s" });
    });

    it("should reject if authentication fails", async () => {
      const error = new Error("error");

      authenticate.mockRejectedValue(error);

      await expect(controller.login(cookieRequest)).rejects.toBe(error);
    });

    it("should reject in case of unknown strategy", async () => {
      cookieRequest.input.args.strategy = "foobar";

      await rejects(controller.login(cookieRequest), {
        id: "security.credentials.unknown_strategy",
      });
    });
  });

  /** A logout request carrying a signed token, cookie-bound or not. */
  const logoutRequest = (cookieAuth: boolean) => {
    const signed = jwt.sign({ _id: "admin" }, config.security.jwt!.secret, {
      algorithm: config.security.jwt!.algorithm,
    });
    const token = new Token(
      invalid({ _id: `foo#${signed}`, jwt: signed, userId: "foo" }),
    );

    const req = new Request(
      cookieAuth
        ? { action: "logout", controller: "auth", cookieAuth: true }
        : { action: "logout", controller: "auth", jwt: signed },
      invalid({ connectionId: "papagaya", token, user: { _id: "foo" } }),
    );

    if (cookieAuth) {
      req.input.headers = { cookie: `authToken=${signed};` };
    }

    return req;
  };

  describe("#logout", () => {
    beforeEach(() => {
      request = logoutRequest(false);
    });

    it("should expire token", async () => {
      /* The Mocha spec asserted `response.responseObject` is `instanceof
       * Object`, on a method that answers `{ acknowledged: true }` and has no
       * `responseObject` — and `should(undefined).be.instanceof(Object)`
       * passes. Four tests across the two blocks said this. */
      await expect(controller.logout(request)).resolves.toEqual({
        acknowledged: true,
      });

      expect(ask).toHaveBeenCalledWith(
        "core:security:token:delete",
        request.context.token,
      );
    });

    it("should expire all tokens that are not API Keys at once", async () => {
      request.input.args.global = true;

      await controller.logout(request);

      expect(ask).toHaveBeenCalledWith(
        "core:security:token:deleteByKuid",
        "foo",
        { keepApiKeys: true },
      );
    });

    it("should emit an error if the token cannot be expired", async () => {
      const error = new Error("Mocked error");

      failures.set("core:security:token:delete", error);

      await expect(controller.logout(request)).rejects.toBe(error);
    });

    it("should reject if invoked by an anonymous user", async () => {
      userOf(request)._id = "-1";

      await rejects(
        controller.logout(request),
        { id: "security.rights.unauthorized" },
        UnauthorizedError,
      );
    });

    it("should not expires the token if this is an API Key", async () => {
      Object.defineProperty(request.context.token, "type", {
        get: () => "apiKey",
      });

      await controller.logout(request);

      expect(asked("core:security:token:delete")).toHaveLength(0);
    });
  });

  describe("#logout with cookies", () => {
    beforeEach(() => {
      config.http.cookieAuthentication = true;
      request = logoutRequest(true);
    });

    it("should clear the authToken cookie", async () => {
      await controller.logout(request);

      // An empty value, not the string "null": `cookie.serialize` stringifies
      // what it is given, and the funnel still carries a `=== "null"` check
      // for the cookies that header put in browsers.
      expect(cookiesOf(request)).toEqual([
        expect.stringMatching(
          /^authToken=; Path=\/; HttpOnly; SameSite=Strict$/,
        ),
      ]);
    });

    it("should expire token", async () => {
      await expect(controller.logout(request)).resolves.toEqual({
        acknowledged: true,
      });

      expect(ask).toHaveBeenCalledWith(
        "core:security:token:delete",
        request.context.token,
      );
    });

    it("should expire all tokens that are not ApiKeys at once", async () => {
      request.input.args.global = true;

      await controller.logout(request);

      expect(ask).toHaveBeenCalledWith(
        "core:security:token:deleteByKuid",
        "foo",
        { keepApiKeys: true },
      );
    });

    it("should emit an error if the token cannot be expired", async () => {
      const error = new Error("Mocked error");

      failures.set("core:security:token:delete", error);

      await expect(controller.logout(request)).rejects.toBe(error);
    });

    it("should not expire the token if this is an apikey", async () => {
      Object.defineProperty(request.context.token, "type", {
        get: () => "apiKey",
      });

      await expect(controller.logout(request)).resolves.toEqual({
        acknowledged: true,
      });

      expect(asked("core:security:token:delete")).toHaveLength(0);
    });
  });

  describe("#getCurrentUser", () => {
    const currentUserRequest = () =>
      new Request(
        { body: {} },
        invalid({ token: { userId: "admin" }, user: { _id: "admin" } }),
      );

    it("should return the user given in the context", async () => {
      const req = currentUserRequest();

      await expect(controller.getCurrentUser(req)).resolves.toMatchObject(
        invalid<JSONObject>(req.context.user),
      );
    });

    it("should a PluginImplementationError if a plugin throws a non-KuzzleError error", async () => {
      pluginsManager.listStrategies.mockReturnValue(["foo"]);
      pluginsManager.getStrategyMethod.mockReturnValue(async () => {
        throw new Error("bar");
      });

      await expect(
        controller.getCurrentUser(currentUserRequest()),
      ).rejects.toBeInstanceOf(PluginImplementationError);
    });
  });

  describe("#checkToken", () => {
    const verifyEvent = "core:security:token:verify";
    let testToken: Token;

    beforeEach(() => {
      request = new Request(
        { action: "checkToken", body: { token: "foobar" }, controller: "auth" },
        {},
      );
      testToken = new Token(invalid({ expiresAt: 42, userId: "durres" }));
    });

    it("should return anonymous token if no token is specified", async () => {
      answers[verifyEvent] = new Token(invalid({ userId: "-1" }));

      const response = await controller.checkToken(new Request({ body: {} }));

      expect(asked(verifyEvent)).toEqual([[verifyEvent, null]]);
      expect(response).toMatchObject({
        expiresAt: null,
        kuid: "-1",
        valid: true,
      });
    });

    it("should return a valid response if the token is valid", async () => {
      answers[verifyEvent] = testToken;

      const response = await controller.checkToken(request);

      expect(asked(verifyEvent)).toEqual([[verifyEvent, "foobar"]]);
      expect(response).toMatchObject({
        expiresAt: testToken.expiresAt,
        kuid: "durres",
        valid: true,
      });
      expect(response.state).toBeUndefined();
    });

    it("should return a valid response if the token is not valid", async () => {
      failures.set(verifyEvent, new UnauthorizedError("foobar"));

      const response = await controller.checkToken(request);

      expect(asked(verifyEvent)).toEqual([[verifyEvent, "foobar"]]);
      expect(response).toMatchObject({ state: "foobar", valid: false });
      expect(response.expiresAt).toBeUndefined();
    });

    it("should return a rejected promise if an error occurs", async () => {
      const error = new InternalError("Foobar");

      failures.set(verifyEvent, error);

      await expect(controller.checkToken(request)).rejects.toBe(error);
    });
  });

  describe("#checkToken with cookies", () => {
    const verifyEvent = "core:security:token:verify";
    let testToken: Token;

    beforeEach(() => {
      config.http.cookieAuthentication = true;

      request = new Request(
        {
          action: "checkToken",
          body: {},
          controller: "auth",
          cookieAuth: true,
        },
        {},
      );
      request.input.jwt = "foobar";
      testToken = new Token(invalid({ expiresAt: 42, userId: "durres" }));
    });

    it("should return anonymous token if no token is provided in the cookie", async () => {
      answers[verifyEvent] = new Token(invalid({ userId: "-1" }));

      const req = new Request({ body: {}, cookieAuth: true });

      req.input.headers = { cookie: "authToken=;" };

      const response = await controller.checkToken(req);

      expect(asked(verifyEvent)).toEqual([[verifyEvent, null]]);
      expect(response).toMatchObject({
        expiresAt: null,
        kuid: "-1",
        valid: true,
      });
    });

    it("should return a valid response if the token is valid", async () => {
      answers[verifyEvent] = testToken;

      const response = await controller.checkToken(request);

      expect(asked(verifyEvent)).toEqual([[verifyEvent, "foobar"]]);
      expect(response).toMatchObject({
        expiresAt: testToken.expiresAt,
        kuid: "durres",
        valid: true,
      });
      expect(response.state).toBeUndefined();
    });

    it("should return a valid response if the token is not valid", async () => {
      failures.set(verifyEvent, new UnauthorizedError("foobar"));

      const response = await controller.checkToken(request);

      expect(asked(verifyEvent)).toEqual([[verifyEvent, "foobar"]]);
      expect(response).toMatchObject({ state: "foobar", valid: false });
      expect(response.expiresAt).toBeUndefined();
    });

    it("should return a rejected promise if an error occurs", async () => {
      const error = new InternalError("Foobar");

      failures.set(verifyEvent, error);

      await expect(controller.checkToken(request)).rejects.toBe(error);
    });
  });

  /** An authenticated request, as the funnel hands one to `refreshToken`. */
  const refreshRequest = (data: JSONObject = {}) =>
    new Request(
      data,
      invalid({
        token: { _id: "_id", jwt: "jwt", refreshed: false, userId: "user" },
        user: { _id: "user" },
      }),
    );

  const newToken = {
    _id: "_id",
    expiresAt: 42,
    jwt: "new-token",
    ttl: "ttl",
    userId: "userId",
  };

  describe("#refreshToken", () => {
    const refreshEvent = "core:security:token:refresh";

    it("should reject if the user is not authenticated", async () => {
      const req = new Request(
        {},
        invalid({
          token: { _id: "-1", userId: "anonymous" },
          user: { _id: "-1" },
        }),
      );

      await rejects(
        controller.refreshToken(req),
        { id: "security.rights.unauthorized" },
        UnauthorizedError,
      );
    });

    it("should execute the strategy refresh method when provided", async () => {
      const strategyRefresh = vi.fn(async () => undefined);
      const req = refreshRequest({
        expiresIn: "42h",
        strategy: "someStrategy",
      });

      pluginsManager.getStrategyMethod.mockReturnValue(strategyRefresh);
      answers[refreshEvent] = newToken;

      await expect(controller.refreshToken(req)).resolves.toEqual({
        _id: "userId",
        expiresAt: 42,
        jwt: "new-token",
        ttl: "ttl",
      });

      expect(pluginsManager.getStrategyMethod).toHaveBeenCalledWith(
        "someStrategy",
        "refreshToken",
      );
      expect(strategyRefresh).toHaveBeenCalledWith(req);
      expect(ask).toHaveBeenCalledWith(
        refreshEvent,
        req.context.user,
        req.context.token,
        "42h",
      );
    });

    it("should reject if the strategy refresh fails", async () => {
      const strategyRefresh = vi.fn(async () => {
        throw new Error("strategy refresh failed");
      });
      const req = refreshRequest({ strategy: "someStrategy" });

      pluginsManager.getStrategyMethod.mockReturnValue(strategyRefresh);

      await rejects(
        controller.refreshToken(req),
        { id: "security.token.refresh_forbidden" },
        UnauthorizedError,
      );

      expect(strategyRefresh).toHaveBeenCalledWith(req);
      expect(asked(refreshEvent)).toHaveLength(0);
    });

    it("should use expiresIn returned by strategy refresh method", async () => {
      const strategyRefresh = vi.fn(async () => ({ expiresIn: "1h" }));
      const req = refreshRequest({
        expiresIn: "42h",
        strategy: "someStrategy",
      });

      pluginsManager.getStrategyMethod.mockReturnValue(strategyRefresh);
      answers[refreshEvent] = newToken;

      await controller.refreshToken(req);

      expect(strategyRefresh).toHaveBeenCalledWith(req);
      expect(ask).toHaveBeenCalledWith(
        refreshEvent,
        req.context.user,
        req.context.token,
        "1h",
      );
    });

    it("should provide a new jwt and expire the current one ", async () => {
      const req = refreshRequest({ expiresIn: "42h" });

      answers[refreshEvent] = newToken;

      await expect(controller.refreshToken(req)).resolves.toEqual({
        _id: "userId",
        expiresAt: 42,
        jwt: "new-token",
        ttl: "ttl",
      });

      expect(ask).toHaveBeenCalledWith(
        refreshEvent,
        req.context.user,
        req.context.token,
        "42h",
      );
    });
  });

  describe("#refreshToken with cookies", () => {
    const refreshEvent = "core:security:token:refresh";

    beforeEach(() => {
      config.internal.allowAllOrigins = false;
      config.http.cookieAuthentication = true;
    });

    it("should reject if the user is not authenticated", async () => {
      const req = new Request(
        { cookieAuth: true },
        invalid({
          token: { _id: "-1", userId: "anonymous" },
          user: { _id: "-1" },
        }),
      );

      await rejects(
        controller.refreshToken(req),
        { id: "security.rights.unauthorized" },
        UnauthorizedError,
      );
    });

    it("should provide a new jwt and expire the current one ", async () => {
      const req = refreshRequest({ cookieAuth: true, expiresIn: "42h" });

      answers[refreshEvent] = newToken;

      await expect(controller.refreshToken(req)).resolves.toEqual({
        _id: "userId",
        expiresAt: 42,
        ttl: "ttl",
      });

      expect(cookiesOf(req)).toEqual([
        expect.stringMatching(setCookie("new-token")),
      ]);
      expect(ask).toHaveBeenCalledWith(
        refreshEvent,
        req.context.user,
        req.context.token,
        "42h",
      );
    });
  });

  describe("#updateSelf", () => {
    const selfRequest = (body: JSONObject, id = "admin") =>
      new Request(
        { body },
        invalid({ token: { _id: id, userId: id }, user: { _id: id } }),
      );

    it("should return a valid response", async () => {
      const req = selfRequest({ foo: "bar" });

      answers["core:security:user:update"] = user;

      await expect(controller.updateSelf(req)).resolves.toBeInstanceOf(Object);

      expect(ask).toHaveBeenCalledWith(
        "core:security:user:update",
        "admin",
        null,
        { foo: "bar" },
        { refresh: "wait_for", retryOnConflict: 10, userId: "admin" },
      );
    });

    it("should reject an error if profile is specified", async () => {
      await rejects(
        controller.updateSelf(
          selfRequest({ foo: "bar", profileIds: ["test"] }),
        ),
        {
          id: "api.assert.forbidden_argument",
          message:
            'The argument "body.profileIds" is not allowed by this API action.',
        },
      );
    });

    it("should reject an error if _id is specified in the body", async () => {
      await rejects(
        controller.updateSelf(selfRequest({ _id: "test", foo: "bar" })),
        {
          id: "api.assert.forbidden_argument",
          message: 'The argument "body._id" is not allowed by this API action.',
        },
      );
    });

    it("should reject an error if current user is anonymous", async () => {
      await rejects(
        controller.updateSelf(selfRequest({ foo: "bar" }, "-1")),
        { id: "security.rights.unauthorized" },
        UnauthorizedError,
      );
    });
  });

  describe("#getMyRights", () => {
    it("should be able to get current user's rights", async () => {
      const rights = {
        rights1: {
          action: "get",
          collection: "bar",
          controller: "read",
          index: "foo",
          value: "allowed",
        },
        rights2: {
          action: "delete",
          collection: "*",
          controller: "write",
          index: "*",
          value: "conditional",
        },
      };

      const req = new Request(
        { body: {} },
        invalid({
          token: { userId: "test" },
          user: { _id: "test", getRights: async () => rights },
        }),
      );

      // `getMyRights` is declared `Promise<object>`, so its own `hits` is not
      // reachable through the declaration.
      const response = invalid<{ hits: JSONObject[] }>(
        await controller.getMyRights(req),
      );

      expect(response.hits).toHaveLength(2);
      expect(response.hits).toEqual(
        expect.arrayContaining([rights.rights1, rights.rights2]),
      );
    });
  });

  describe("#getAuthenticationStrategies", () => {
    it("should return a valid response", async () => {
      await expect(controller.getStrategies()).resolves.toEqual([]);

      expect(pluginsManager.listStrategies).toHaveBeenCalledOnce();
    });
  });

  describe("Credentials", () => {
    const credentialsRequest = (action: string, body?: JSONObject) =>
      new Request(
        {
          action,
          controller: "security",
          strategy: "someStrategy",
          ...(body ? { body } : {}),
        },
        invalid({ user: { _id: "someUserId" } }),
      );

    const rejectingMethod = () => {
      pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
      pluginsManager.getStrategyMethod.mockReturnValue(async () => {
        throw new Error("foo");
      });
    };

    describe("#createMyCredentials", () => {
      it("should call the plugin create method", async () => {
        const method = vi.fn(async () => ({ foo: "bar" }));

        request = credentialsRequest("createCredentials", {
          some: "credentials",
        });
        pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
        pluginsManager.getStrategyMethod.mockReturnValue(method);

        await expect(controller.createMyCredentials(request)).resolves.toEqual({
          foo: "bar",
        });

        expect(pluginsManager.getStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "create"],
          ["someStrategy", "validate"],
        ]);
        /*
         * `validate` runs FIRST and `create` second, and `validate` takes a
         * fifth argument — `isUpdate`, `false` here and `true` in
         * `updateMyCredentials`. The Mocha spec read `firstCall.args[0]` to
         * `[3]` and `secondCall.args[0]` to `[3]`, which are identical for the
         * two calls: it could see neither the order nor the flag.
         */
        expect(method.mock.calls).toEqual([
          [
            request,
            { some: "credentials" },
            "someUserId",
            "someStrategy",
            false,
          ],
          [request, { some: "credentials" }, "someUserId", "someStrategy"],
        ]);
      });

      it("should throw a PluginImplementationError if a non-KuzzleError is received", async () => {
        rejectingMethod();

        await expect(
          controller.createMyCredentials(
            credentialsRequest("createCredentials", { some: "credentials" }),
          ),
        ).rejects.toBeInstanceOf(PluginImplementationError);
      });
    });

    describe("#updateMyCredentials", () => {
      it("should call the plugin update method", async () => {
        const method = vi.fn(async () => ({ foo: "bar" }));

        request = credentialsRequest("createCredentials", {
          some: "credentials",
        });
        pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
        pluginsManager.getStrategyMethod.mockReturnValue(method);

        await expect(controller.updateMyCredentials(request)).resolves.toEqual({
          foo: "bar",
        });

        expect(pluginsManager.getStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "update"],
          ["someStrategy", "validate"],
        ]);
        // `validate` first, with `isUpdate` true — see `createMyCredentials`.
        expect(method.mock.calls).toEqual([
          [
            request,
            { some: "credentials" },
            "someUserId",
            "someStrategy",
            true,
          ],
          [request, { some: "credentials" }, "someUserId", "someStrategy"],
        ]);
      });

      it("should throw a PluginImplementationError if a non-KuzzleError is thrown", async () => {
        rejectingMethod();

        await expect(
          controller.updateMyCredentials(
            credentialsRequest("createCredentials", { some: "credentials" }),
          ),
        ).rejects.toBeInstanceOf(PluginImplementationError);
      });
    });

    describe("#credentialsExist", () => {
      it("should call the plugin exists method", async () => {
        const method = vi.fn(async () => ({ foo: "bar" }));

        request = credentialsRequest("hasCredentials");
        pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
        pluginsManager.getStrategyMethod.mockReturnValue(method);

        await expect(controller.credentialsExist(request)).resolves.toEqual({
          foo: "bar",
        });

        expect(pluginsManager.getStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "exists"],
        ]);
        expect(method.mock.calls).toEqual([
          [request, "someUserId", "someStrategy"],
        ]);
      });

      it("should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin", async () => {
        rejectingMethod();

        await expect(
          controller.credentialsExist(credentialsRequest("hasCredentials")),
        ).rejects.toBeInstanceOf(PluginImplementationError);
      });
    });

    describe("#validateMyCredentials", () => {
      it("should call the plugin validate method", async () => {
        const method = vi.fn(async () => ({ foo: "bar" }));

        request = credentialsRequest("validateCredentials", {
          some: "credentials",
        });
        pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
        pluginsManager.getStrategyMethod.mockReturnValue(method);

        await expect(
          controller.validateMyCredentials(request),
        ).resolves.toEqual({ foo: "bar" });

        expect(pluginsManager.getStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "validate"],
        ]);
        expect(method.mock.calls).toEqual([
          [
            request,
            { some: "credentials" },
            "someUserId",
            "someStrategy",
            false,
          ],
        ]);
      });

      it("should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin", async () => {
        rejectingMethod();

        await expect(
          controller.validateMyCredentials(
            credentialsRequest("validateCredentials", { some: "credentials" }),
          ),
        ).rejects.toBeInstanceOf(PluginImplementationError);
      });
    });

    describe("#deleteMyCredentials", () => {
      it("should call the plugin delete method", async () => {
        const method = vi.fn(async () => ({ foo: "bar" }));

        request = credentialsRequest("deleteCredentials");
        pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
        pluginsManager.getStrategyMethod.mockReturnValue(method);

        await expect(controller.deleteMyCredentials(request)).resolves.toEqual({
          acknowledged: true,
        });

        expect(pluginsManager.getStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "delete"],
        ]);
        expect(method.mock.calls).toEqual([
          [request, "someUserId", "someStrategy"],
        ]);
      });

      it("should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin", async () => {
        rejectingMethod();

        await expect(
          controller.deleteMyCredentials(
            credentialsRequest("deleteCredentials"),
          ),
        ).rejects.toBeInstanceOf(PluginImplementationError);
      });
    });

    describe("#getMyCredentials", () => {
      it("should call the plugin getInfo method if it is provided", async () => {
        const method = vi.fn(async () => ({ foo: "bar" }));

        request = credentialsRequest("getCredentials");
        pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
        pluginsManager.hasStrategyMethod.mockReturnValue(true);
        pluginsManager.getStrategyMethod.mockReturnValue(method);

        await expect(controller.getMyCredentials(request)).resolves.toEqual({
          foo: "bar",
        });

        expect(pluginsManager.hasStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "getInfo"],
        ]);
        expect(pluginsManager.getStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "getInfo"],
        ]);
        expect(method.mock.calls).toEqual([
          [request, "someUserId", "someStrategy"],
        ]);
      });

      it("should resolve to an empty object if getInfo method is not provided", async () => {
        request = credentialsRequest("getCredentials");
        pluginsManager.listStrategies.mockReturnValue(["someStrategy"]);
        pluginsManager.hasStrategyMethod.mockReturnValue(false);
        pluginsManager.getStrategyMethod.mockReturnValue(
          vi.fn(async () => ({ foo: "bar" })),
        );

        await expect(controller.getMyCredentials(request)).resolves.toEqual({});

        expect(pluginsManager.hasStrategyMethod.mock.calls).toEqual([
          ["someStrategy", "getInfo"],
        ]);
        expect(pluginsManager.getStrategyMethod).not.toHaveBeenCalled();
      });

      it("should throw a PluginImplementationError if a non-KuzzleError is thrown by a plugin", async () => {
        rejectingMethod();
        pluginsManager.hasStrategyMethod.mockReturnValue(true);

        await expect(
          controller.getMyCredentials(credentialsRequest("getCredentials")),
        ).rejects.toBeInstanceOf(PluginImplementationError);
      });
    });
  });
});
