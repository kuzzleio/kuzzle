import passport, { Strategy } from "passport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PassportWrapper from "../../../lib/core/auth/passportWrapper";
import PassportResponse from "../../../lib/core/auth/passportResponse";
import { ForbiddenError } from "../../../lib/kerror/errors/forbiddenError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import { UnauthorizedError } from "../../../lib/kerror/errors/unauthorizedError";
import { invalid } from "../../helpers/invalid";

/**
 * What the wrapper is for: it drives passport's callback protocol and turns
 * each of its four outcomes — success, failure, error, redirect — into a
 * promise. So the fixture is a **real passport strategy** that takes one of
 * them, registered in the real passport registry.
 *
 * The Mocha spec replaced the `passport` module with four stubs instead, and
 * then had to un-replace it for its one redirect test, which is the only one
 * that exercised the protocol rather than the stub. Nothing here is mocked:
 * `passport` is a registry with no I/O, and the strategies below are the
 * fixture.
 */
/**
 * The four callbacks passport injects into a strategy before calling it.
 * `@types/passport`'s `Strategy` declares only `authenticate`, because they
 * are `StrategyCreated`'s — bolted on by the framework at call time.
 */
interface Outcomes {
  error(error: unknown): void;
  fail(info?: unknown, status?: number): void;
  redirect(url: string, status?: number): void;
  success(user: unknown, info?: unknown): void;
}

class Outcome extends Strategy {
  constructor(private readonly take: (strategy: Outcomes) => void) {
    super();
  }

  authenticate() {
    this.take(this as unknown as Outcomes);
  }
}

/** A strategy that succeeds with `user`. */
const succeedsWith = (user: unknown) =>
  new Outcome((strategy) => strategy.success(invalid(user)));

/** A strategy that refuses the credentials, with an explanatory info object. */
const failsWith = (info: unknown) =>
  new Outcome((strategy) => strategy.fail(invalid(info)));

/** A strategy that errors out. */
const errorsWith = (error: unknown) =>
  new Outcome((strategy) => strategy.error(invalid(error)));

/** A strategy that redirects, the way an OAuth one does. */
const redirectsTo = (url: string) =>
  new Outcome((strategy) => strategy.redirect(url));

/** A strategy that throws out of `authenticate` itself. */
const throwing = (error: unknown) =>
  new Outcome(() => {
    throw error;
  });

describe("#core/auth/PassportWrapper", () => {
  let wrapper: PassportWrapper;
  let registered: string[];

  /** Registers a strategy under a fresh name, and remembers to remove it. */
  const register = (strategy: Strategy, options?: Record<string, unknown>) => {
    const name = `strategy-${registered.length}`;

    registered.push(name);
    wrapper.use(name, strategy, options);

    return name;
  };

  beforeEach(() => {
    registered = [];
    wrapper = new PassportWrapper();
  });

  afterEach(() => {
    /* The passport registry is a module-level singleton, shared by every test. */
    for (const name of registered) {
      wrapper.unuse(name);
    }
  });

  describe("#use / #unuse", () => {
    it("registers a strategy with passport, and an empty option set of its own", async () => {
      const user = { username: "jdoe" };

      wrapper.use("foobar", succeedsWith(user));
      registered.push("foobar");

      expect(wrapper.options.foobar).toEqual({});
      /*
       * Asserted through passport rather than against a spy on it: what the
       * next `authenticate("foobar")` finds is the question, and a spy would
       * only have said that `use` was called.
       */
      expect(await wrapper.authenticate({}, "foobar")).toEqual(user);
    });

    it("keeps the options it was given, and hands them to passport at authentication", async () => {
      const options = { scope: "the-scope" };
      const name = register(succeedsWith({ username: "jdoe" }), options);
      const authenticate = vi.spyOn(passport, "authenticate");

      expect(wrapper.options[name]).toEqual(options);

      await wrapper.authenticate({}, name);

      expect(authenticate).toHaveBeenCalledWith(
        name,
        options,
        expect.any(Function),
      );
    });

    it("forgets both the strategy and its options on unuse", async () => {
      wrapper.use("foobar", succeedsWith({}), { scope: "the-scope" });
      wrapper.unuse("foobar");

      expect(wrapper.options.foobar).toBeUndefined();

      /*
       * Passport reports an unknown strategy by calling `next(error)`. The
       * wrapper used to invoke the middleware with `(request, response)` only,
       * so this was answered `next is not a function`
       * ([TD-80](../../../docs/adr-001/type-debt-register.md#td-80)).
       */
      await expect(wrapper.authenticate({}, "foobar")).rejects.toMatchObject({
        id: "plugin.runtime.unexpected_error",
        message: expect.stringContaining(
          'Unknown authentication strategy "foobar"',
        ),
      });
    });
  });

  describe("#authenticate", () => {
    it("resolves to the user when the strategy succeeds", async () => {
      const user = { username: "jdoe" };
      const name = register(succeedsWith(user));

      expect(await wrapper.authenticate({}, name)).toEqual(user);
    });

    it("rejects with the strategy's own message when it refuses the credentials", async () => {
      const name = register(failsWith({ message: "foobar" }));
      const rejection = wrapper.authenticate({}, name);

      await expect(rejection).rejects.toBeInstanceOf(UnauthorizedError);
      await expect(rejection).rejects.toMatchObject({ message: "foobar" });
    });

    it("forwards a KuzzleError the strategy raised", async () => {
      const error = new ForbiddenError("foobar");
      const name = register(errorsWith(error));

      await expect(wrapper.authenticate({}, name)).rejects.toBe(error);
    });

    it("wraps anything else the strategy raised", async () => {
      const name = register(errorsWith(new Error("foobar")));
      const rejection = wrapper.authenticate({}, name);

      await expect(rejection).rejects.toBeInstanceOf(PluginImplementationError);
      await expect(rejection).rejects.toMatchObject({
        id: "plugin.runtime.unexpected_error",
      });
    });

    it("forwards a KuzzleError thrown out of authenticate itself", async () => {
      const name = register(throwing(new ForbiddenError("foobar")));

      await expect(wrapper.authenticate({}, name)).rejects.toMatchObject({
        message: "foobar",
      });
    });

    it("wraps anything else thrown out of authenticate itself", async () => {
      const name = register(throwing(new Error("foobar")));
      const rejection = wrapper.authenticate({}, name);

      await expect(rejection).rejects.toBeInstanceOf(PluginImplementationError);
      await expect(rejection).rejects.toMatchObject({
        id: "plugin.runtime.unexpected_error",
      });
    });

    /*
     * Not covered by the Mocha spec: a strategy is plugin code and may throw
     * something that is not an `Error` at all. The subject wraps that in one
     * before reading `.message` off it.
     */
    it("wraps a thrown non-Error", async () => {
      const name = register(throwing("just a string"));

      await expect(wrapper.authenticate({}, name)).rejects.toMatchObject({
        id: "plugin.runtime.unexpected_error",
        message: expect.stringContaining("just a string"),
      });
    });

    it("resolves to a redirection response when the strategy redirects", async () => {
      const name = register(redirectsTo("http://example.org"));

      const response = (await wrapper.authenticate(
        {},
        name,
      )) as PassportResponse;

      expect(response).toBeInstanceOf(PassportResponse);
      expect(response.statusCode).toBe(302);
      expect(response.getHeader("Location")).toBe("http://example.org");
    });

    /*
     * ⚠️ The Mocha spec registered its redirecting strategy with
     * `passportWrapper.use(new MockupStrategy("mockup", stub))` — **one
     * argument**, where the signature is `use(name, strategy, opts)`. It
     * worked because `passport.use` accepts that form and reads the name off
     * the strategy, but the wrapper then stored the options under
     * `this.options[<the strategy object>]`, a key that stringifies to
     * "[object Object]". TypeScript refuses the call outright, which is how
     * the port found it; and the options of a strategy registered that way
     * were never going to be found again.
     */
    it("finds no options for a strategy registered under another name", async () => {
      const strategy = redirectsTo("http://example.org");

      wrapper.use("mockup", strategy, { scope: "the-scope" });
      registered.push("mockup");

      expect(wrapper.options.mockup).toEqual({ scope: "the-scope" });
      expect(wrapper.options["[object Object]"]).toBeUndefined();
    });
  });
});
