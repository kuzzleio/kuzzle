import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Funnel from "../../../lib/api/funnel";
import { KuzzleRequest } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { ServiceUnavailableError } from "../../../lib/kerror/errors/serviceUnavailableError";
import { TooManyRequestsError } from "../../../lib/kerror/errors/tooManyRequestsError";
import { UnauthorizedError } from "../../../lib/kerror/errors/unauthorizedError";
import kuzzleStateEnum from "../../../lib/kuzzle/kuzzleStateEnum";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

/**
 * `execute` is callback-based, so every test awaits the callback rather than
 * the call. The return code — 1 refused, 0 executing, -1 delayed — is the other
 * half of its contract, and the Mocha spec asserted it exactly once.
 */
type Outcome = {
  // `number | null`, not `number`: the JSDoc says "-1 delayed, 0 executing,
  // 1 refused", and one refusal — `unauthorized_origin` — goes through
  // `_executeError`, which is declared `): null`. Nothing in `lib/` reads the
  // code (both callers ignore it), so this is a documentation/return-type
  // disagreement rather than a defect; the spec records what is returned.
  code: number | null;
  error: Error | null;
  response: KuzzleRequest;
};

const execute = (funnel: Funnel, request: KuzzleRequest): Promise<Outcome> =>
  new Promise((resolve) => {
    /* The callback can fire before `execute` has even returned — four of its
     * refusals answer synchronously — so both halves are collected and the
     * promise settles once each has arrived. */
    let answer: { error: Error | null; response: KuzzleRequest } | null = null;
    /** Not a code the subject ever answers: "execute has not returned yet". */
    let code: number | null = Number.NaN;

    const settle = () => {
      if (answer !== null && !Number.isNaN(code)) {
        resolve({ code, ...answer });
      }
    };

    code = funnel.execute(request, (error, response) => {
      answer = { error, response };
      settle();
    });

    settle();
  });

/** `_isOriginAuthorized` and `_playPendingRequests` are both private. */
type Internals = {
  _isOriginAuthorized: (origin: string) => boolean;
  _playPendingRequests: () => void;
};

const internalsOf = (funnel: Funnel) => invalid<Internals>(funnel);

describe("#api/funnel.execute", () => {
  let funnel: Funnel;
  let config: Record<string, any>;
  let request: KuzzleRequest;
  let isConnectionAlive: ReturnType<typeof vi.fn>;
  let asyncStoreRun: ReturnType<typeof vi.fn>;
  let asyncStoreSet: ReturnType<typeof vi.fn>;
  let emit: ReturnType<typeof vi.fn>;
  let pipe: ReturnType<typeof vi.fn>;
  let kuzzle: Record<string, any>;

  const requestFor = (input: Record<string, unknown>) =>
    new KuzzleRequest(input, {
      connection: { id: "connectionid" },
      token: null,
    });

  beforeEach(() => {
    config = {
      /* `_executeError` dumps on some errors, and reads this shape before
       * deciding not to. */
      dump: { enabled: false, handledErrors: { enabled: false } },
      http: { accessControlAllowOrigin: ["foo"] },
      internal: { allowAllOrigins: false },
      limits: {
        concurrentRequests: 50,
        requestsBufferSize: 50000,
        /* -1 so the overload hook fires on the first pending request: the
         * queue's length is always above it. */
        requestsBufferWarningThreshold: -1,
      },
      plugins: {},
      server: { strictSdkVersion: false },
      services: { storageEngine: { client: {} } },
      version: "2.56.0",
    };

    isConnectionAlive = vi.fn(() => true);
    asyncStoreSet = vi.fn();
    asyncStoreRun = vi.fn((callback: () => void) => callback());
    emit = vi.fn();
    pipe = vi.fn(async (_event: string, payload: unknown) => payload);

    kuzzle = stubKuzzle({
      ask: vi.fn(async () => ({ _id: "-1" })),
      asyncStore: { run: asyncStoreRun, set: asyncStoreSet },
      config,
      emit,
      log: stubLogger(),
      pipe,
      router: { isConnectionAlive },
      state: kuzzleStateEnum.RUNNING,
    });

    funnel = new Funnel();
    funnel.controllers = new Map([
      [
        "foo",
        invalid({
          _isAction: () => true,
          bar: vi.fn(),
        }),
      ],
    ]);

    /* The three collaborators `execute` delegates to, each with its own spec
     * in this directory. */
    funnel.checkRights = vi.fn(async (req: KuzzleRequest) => req);
    funnel.processRequest = vi.fn(async (req: KuzzleRequest) => req);
    vi.spyOn(funnel.rateLimiter, "isAllowed").mockResolvedValue(true);
    vi.spyOn(internalsOf(funnel), "_playPendingRequests").mockImplementation(
      () => {},
    );

    request = requestFor({ action: "bar", controller: "foo" });
  });

  afterEach(async () => {
    /**
     * ⚠️ `execute` answers its caller from inside a promise chain that is not
     * finished when the callback runs — `request:afterExecution` is awaited
     * around it, and the overload hook fires from a path with no callback at
     * all. Tearing the fixture down on the next line leaves that chain reading
     * a `global.kuzzle` that is gone, which surfaces as an unhandled rejection
     * attributed to whichever test runs next. So the fixture waits for the
     * subject to be done, not just for its answer.
     */
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 5));

    restoreKuzzle();
    vi.restoreAllMocks();
  });

  describe("a request that cannot be executed at all", () => {
    /* All four answer 1 — "refused, nothing happened" — and the Mocha spec
     * asserted that code for none of them. */
    it("should refuse a request with no controller", async () => {
      const { code, error, response } = await execute(
        funnel,
        requestFor({ action: "bar" }),
      );

      expect(code).toBe(1);
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error).toMatchObject({ id: "api.assert.missing_argument" });
      expect(error?.message).toBe('Missing argument "controller".');
      expect(response.input.action).toBe("bar");
    });

    it("should refuse a request with no action", async () => {
      const { code, error } = await execute(
        funnel,
        requestFor({ controller: "foo" }),
      );

      expect(code).toBe(1);
      expect(error).toMatchObject({ id: "api.assert.missing_argument" });
      expect(error?.message).toBe('Missing argument "action".');
    });

    it("should refuse index and collection together with targets", async () => {
      const { code, error } = await execute(
        funnel,
        requestFor({
          action: "bar",
          collection: "collection",
          controller: "foo",
          index: "index",
          targets: [{ collections: ["collection"], index: "index" }],
        }),
      );

      expect(code).toBe(1);
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error).toMatchObject({ id: "api.assert.mutually_exclusive" });
    });

    it("should refuse an unauthorized origin", async () => {
      const isOriginAuthorized = vi
        .spyOn(internalsOf(funnel), "_isOriginAuthorized")
        .mockReturnValue(false);

      request.input.headers = { origin: "foobar" };

      const { error, response } = await execute(funnel, request);

      expect(isOriginAuthorized).toHaveBeenCalledWith("foobar");
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error).toMatchObject({ id: "api.process.unauthorized_origin" });
      expect(error?.message).toBe('The origin "foobar" is not authorized.');
      /* The refusal is recorded on the request, not only handed to the
       * callback: the response is what reaches the client. */
      expect(response.error).toBe(error);
      expect(funnel.checkRights).not.toHaveBeenCalled();
    });

    it("should accept an authorized origin", async () => {
      const isOriginAuthorized = vi
        .spyOn(internalsOf(funnel), "_isOriginAuthorized")
        .mockReturnValue(true);

      request.input.headers = { origin: "foo" };

      const { error } = await execute(funnel, request);

      expect(isOriginAuthorized).toHaveBeenCalledWith("foo");
      expect(error).toBeNull();
    });

    it("should not check an origin the request does not carry", async () => {
      const isOriginAuthorized = vi.spyOn(
        internalsOf(funnel),
        "_isOriginAuthorized",
      );

      request.input.headers = {};

      const { error } = await execute(funnel, request);

      expect(error).toBeNull();
      expect(isOriginAuthorized).not.toHaveBeenCalled();
    });

    it("should discard a request whose connection is gone", async () => {
      isConnectionAlive.mockReturnValue(false);

      const { code, error } = await execute(funnel, request);

      expect(code).toBe(0);
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error?.message).toBe("Client connection dropped");
      expect(funnel.checkRights).not.toHaveBeenCalled();
    });
  });

  describe("a request that runs", () => {
    it("should process the request and answer it", async () => {
      const { code, error, response } = await execute(funnel, request);

      expect(code).toBe(0);
      expect(error).toBeNull();
      expect(response).toBeInstanceOf(KuzzleRequest);
      expect(funnel.processRequest).toHaveBeenCalledExactlyOnceWith(request);
    });

    it("should run inside the async store, with the request in it", async () => {
      await execute(funnel, request);

      expect(asyncStoreRun).toHaveBeenCalledOnce();
      expect(asyncStoreSet).toHaveBeenCalledWith("REQUEST", request);
      expect(pipe).toHaveBeenCalledWith("request:beforeExecution", request);
    });

    /* The pipe may hand back another request, and that one is what runs —
     * the Mocha spec stubbed `pipe` to echo its payload and never varied it. */
    it("should process the request the pipe answered", async () => {
      const modified = requestFor({ action: "bar", controller: "foo" });

      pipe.mockResolvedValue(modified);

      await execute(funnel, request);

      expect(funnel.checkRights).toHaveBeenCalledWith(modified);
      expect(funnel.processRequest).toHaveBeenCalledWith(modified);
    });

    it("should forward an error raised while executing", async () => {
      const error = new ServiceUnavailableError("test");

      vi.mocked(funnel.checkRights).mockRejectedValue(error);

      const { error: reported, response } = await execute(funnel, request);

      expect(reported).toBeInstanceOf(Error);
      expect(response.status).toBe(503);
      expect(response.error?.message).toBe("test");
      expect(funnel.processRequest).not.toHaveBeenCalled();
      expect(funnel.overloaded).toBe(false);
    });

    it("should refuse a request over the rate limit", async () => {
      vi.mocked(funnel.rateLimiter.isAllowed).mockResolvedValue(false);

      const { error } = await execute(funnel, request);

      expect(error).toBeInstanceOf(TooManyRequestsError);
      expect(error).toMatchObject({ id: "api.process.too_many_requests" });
      expect(funnel.processRequest).not.toHaveBeenCalled();
      expect(funnel.overloaded).toBe(false);
    });

    it("should name logins apart when they are rate limited", async () => {
      vi.mocked(funnel.rateLimiter.isAllowed).mockResolvedValue(false);

      const { error } = await execute(
        funnel,
        requestFor({ action: "login", controller: "auth" }),
      );

      expect(error).toMatchObject({
        id: "api.process.too_many_logins_requests",
      });
    });

    it("should refuse every request once Kuzzle is shutting down", async () => {
      kuzzle.state = kuzzleStateEnum.SHUTTING_DOWN;

      const { error, response } = await execute(funnel, request);

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error).toMatchObject({ id: "api.process.shutting_down" });
      expect(response.status).toBe(503);
    });
  });

  describe("the overloaded state", () => {
    /** Fills every execution slot, so the next request is queued. */
    const saturate = () => {
      funnel.concurrentRequests = config.limits.concurrentRequests;
    };

    it("should queue a request when no slot is free", async () => {
      saturate();

      const code = funnel.execute(request, () => {});

      expect(code).toBe(-1);
      expect(funnel.overloaded).toBe(true);
      expect(funnel.processRequest).not.toHaveBeenCalled();
      expect(funnel.pendingRequestsQueue).toHaveLength(1);
      expect(funnel.pendingRequestsQueue.shift()).toBe(request.internalId);

      /* `PendingRequest` is module-private, so what is asserted is what it
       * carries: the request to replay, the function that replays it, and the
       * receiver to replay it on. The Mocha spec reached the class itself with
       * `__get__("PendingRequest")`, which is the only reason that spec needed
       * `rewire` at all. */
      const pending = funnel.pendingRequestsById.get(request.internalId);

      expect(pending?.request).toBe(request);
      expect(pending?.fn).toBeTypeOf("function");
      expect(pending?.context).toBe(funnel);
      expect(internalsOf(funnel)._playPendingRequests).toHaveBeenCalledOnce();
    });

    it("should not run a queued request's callback", () => {
      const callback = vi.fn();

      saturate();
      funnel.execute(request, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(funnel.processRequest).not.toHaveBeenCalled();
    });

    it("should not restart the replayer when already overloaded", () => {
      saturate();
      funnel.overloaded = true;

      funnel.execute(request, () => {});

      expect(funnel.overloaded).toBe(true);
      expect(funnel.pendingRequestsQueue).toHaveLength(1);
      expect(internalsOf(funnel)._playPendingRequests).not.toHaveBeenCalled();
    });

    it("should queue a request only once however often it arrives", () => {
      funnel.concurrentRequests = config.limits.concurrentRequests + 1;
      funnel.overloaded = true;

      for (let i = 0; i < 5; i++) {
        funnel.execute(request, () => {});
      }

      expect(funnel.pendingRequestsQueue).toHaveLength(1);
      expect(funnel.pendingRequestsById.size).toBe(1);
    });

    it("should discard a request once the buffer is full", async () => {
      saturate();
      config.limits.requestsBufferSize = 0;
      funnel.overloaded = true;

      const { error, response } = await execute(funnel, request);

      expect(funnel.overloaded).toBe(true);
      expect(internalsOf(funnel)._playPendingRequests).not.toHaveBeenCalled();
      expect(funnel.processRequest).not.toHaveBeenCalled();
      expect(funnel.pendingRequestsQueue).toHaveLength(0);
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error).toMatchObject({ status: 503 });
      expect(response.status).toBe(503);
      /* A full buffer is an operational event, and the only place it is
       * reported is this event — the Mocha spec asserted neither side. */
      expect(emit).toHaveBeenCalledWith("log:error", error);
    });
  });

  describe("the core:overload hook", () => {
    it("should fire the first time Kuzzle is overloaded", () => {
      funnel.overloaded = true;

      funnel.execute(request, () => {});

      /* ⚠️ The second argument is the overload percentage, and it reached no
       * assertion: sinon's `calledWith` matches a *prefix* of the call, so
       * `calledWith("core:overload")` said nothing about what was reported. */
      expect(emit).toHaveBeenCalledExactlyOnceWith(
        "core:overload",
        expect.any(Number),
      );
    });

    it("should fire again once 500ms have passed", () => {
      funnel.overloaded = true;
      funnel.lastWarningTime = Date.now() - 501;

      funnel.execute(request, () => {});

      expect(emit).toHaveBeenCalledWith("core:overload", expect.any(Number));
    });

    it("should stay quiet within 500ms of the last one", () => {
      const now = Date.now();

      vi.useFakeTimers({ now });

      funnel.overloaded = true;
      funnel.lastWarningTime = now;

      setTimeout(() => funnel.execute(request, () => {}), 499);
      vi.advanceTimersByTime(510);

      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("replaying what was queued", () => {
    beforeEach(() => {
      vi.mocked(internalsOf(funnel)._playPendingRequests).mockRestore();
    });

    /**
     * ⚠️ The replayer is a background loop: it reschedules itself with
     * `setTimeout` for as long as anything is queued, so it outlives the test
     * that started it. Left to run, its next tick reads a `global.kuzzle` the
     * fixture has already put back — an unhandled rejection attributed to
     * whatever test happens to be running then. Draining it is part of the
     * test, not tidiness.
     */
    const drain = async () => {
      while (funnel.pendingRequestsQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      await new Promise((resolve) => setTimeout(resolve, 5));
    };

    it("should play a queued request once a slot frees up", async () => {
      const played = new Promise<void>((resolve) => {
        funnel.concurrentRequests = config.limits.concurrentRequests;
        funnel.execute(request, () => resolve());
      });

      funnel.concurrentRequests = 0;

      await expect(played).resolves.toBeUndefined();
      await drain();
    });

    it("should play queued requests in order", async () => {
      const first = vi.fn();
      const second = new Promise<void>((resolve) => {
        const serialized = request.serialize();
        const secondRequest = new KuzzleRequest(
          Object.assign(serialized.data, { id: "req-2" }),
        );

        funnel.concurrentRequests = config.limits.concurrentRequests;
        funnel.execute(request, first);
        funnel.execute(secondRequest, () => resolve());
      });

      funnel.concurrentRequests = 0;

      await second;

      expect(first).toHaveBeenCalledOnce();
      expect(funnel.overloaded).toBe(false);

      await drain();
    });
  });

  describe("#_isOriginAuthorized", () => {
    it("should allow anything when allowAllOrigins is set", () => {
      config.internal.allowAllOrigins = true;

      expect(internalsOf(funnel)._isOriginAuthorized("foo")).toBe(true);
    });

    it("should compare against the configured list", () => {
      config.http.accessControlAllowOrigin = ["foo", "bar"];
      config.http.accessControlAllowOriginUseRegExp = false;

      expect(internalsOf(funnel)._isOriginAuthorized("bar")).toBe(true);
      expect(internalsOf(funnel)._isOriginAuthorized("foobar")).toBe(false);
    });

    it("should match the configured patterns when asked to", () => {
      config.http.accessControlAllowOrigin = [/bar/, /foo(bar)?/];
      config.http.accessControlAllowOriginUseRegExp = true;

      expect(internalsOf(funnel)._isOriginAuthorized("foobar")).toBe(true);
      expect(internalsOf(funnel)._isOriginAuthorized("baz")).toBe(false);
    });
  });
});
