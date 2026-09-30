import { describe, expect, it } from "vitest";

import waterfall from "../../../lib/kuzzle/event/waterfall";
import { invalid } from "../../helpers/invalid";
import { settle } from "../../helpers/settle";

/**
 * The subject's own two types, restated here because `waterfall.ts` uses
 * `export =` for the function and so cannot export them alongside it.
 *
 * `Step` is what the subject declares — `(...args: unknown[]) => void`. It
 * cannot say *"the last argument is the callback"*: a rest element has to be
 * last, and `[...unknown[], Callback]` is not assignable from a step written
 * with named parameters. So a step reads its callback off the end, which is
 * what the subject passes and what `callbackOf` below narrows.
 */
type Callback = (error?: unknown, ...results: unknown[]) => void;
type Step = (...args: unknown[]) => void;

function isCallback(value: unknown): value is Callback {
  return typeof value === "function";
}

function callbackOf(args: unknown[]): Callback {
  const cb = args[args.length - 1];

  if (!isCallback(cb)) {
    throw new TypeError("waterfall called a step without a callback");
  }

  return cb;
}

/** A step that passes the payload straight through, optionally recording it. */
const passthrough =
  (ran?: string[], name?: string, error?: unknown): Step =>
  (...args) => {
    if (ran && name) {
      ran.push(name);
    }

    callbackOf(args)(error ?? null, ...args.slice(0, -1));
  };

/**
 * `waterfall` reports through a callback invoked with an explicit `this`, and
 * the Mocha spec used its `done` for both — `context = { done }`, then
 * `this.done()` from the callback. vitest has no `done`, so each test returns
 * a promise instead and `context` keeps only what the subject is given: the
 * receiver the callback is called with.
 */

describe("#kuzzle/event/waterfall", () => {
  it("chains callbacks and passes the result along", () =>
    settle<void>((resolve, reject) => {
      const chain: Step[] = [passthrough(), passthrough()];

      waterfall(
        chain,
        [{ data: "foobar" }],
        (error, result) => {
          try {
            expect(error).toBeNull();
            expect(result).toEqual({ data: "foobar" });
            resolve();
          } catch (assertion) {
            reject(assertion);
          }
        },
        {},
      );
    }));

  it("chains callbacks that carry many arguments", () =>
    settle<void>((resolve, reject) => {
      const step: Step = (...args) => {
        const cb = callbackOf(args);

        cb(null, ...args.slice(0, -1));
      };

      waterfall(
        [step, step],
        [21, 42, 84],
        (error, ...result) => {
          try {
            expect(error).toBeNull();
            expect(result).toEqual([21, 42, 84]);
            resolve();
          } catch (assertion) {
            reject(assertion);
          }
        },
        {},
      );
    }));

  it("rejects, rather than resolving, on a chain step that is not callable", () =>
    settle<void>((resolve, reject) => {
      // The regression TD-55 (#2758) fixed: answering "is there a next step?"
      // from the value rather than from the chain resolved the waterfall here,
      // silently skipping every remaining step. A pipe chain is where a plugin
      // denies a request, so the one outcome it must not have is a silent
      // success.
      const ran: string[] = [];
      // `invalid`: a chain hole is exactly what the subject must reject, and
      // `Step[]` forbids writing one.
      const chain: Step[] = [
        passthrough(ran, "first"),
        invalid<Step>(undefined),
        passthrough(ran, "third"),
      ];

      waterfall(
        chain,
        [{ data: "foobar" }],
        (error, result) => {
          try {
            expect(error).toBeInstanceOf(TypeError);
            expect(result).toBeUndefined();
            expect(ran).toEqual(["first"]);
            resolve();
          } catch (assertion) {
            reject(assertion);
          }
        },
        {},
      );
    }));

  it("propagates an error and stops the chain", () =>
    settle<void>((resolve, reject) => {
      const ran: string[] = [];
      const chain: Step[] = [
        passthrough(ran, "first", new Error("error")),
        passthrough(ran, "second"),
      ];

      waterfall(
        chain,
        [{ data: "foobar" }],
        (error, result) => {
          try {
            expect(error).not.toBeNull();
            expect(result).toBeUndefined();
            // Not in the Mocha spec: "propagates" is only half the claim —
            // the other half is that nothing downstream ran.
            expect(ran).toEqual(["first"]);
            resolve();
          } catch (assertion) {
            reject(assertion);
          }
        },
        {},
      );
    }));

  // The callback is invoked with the `context` the caller passes as its
  // receiver; the Mocha spec relied on that (`this.done()`) without asserting
  // it, so a change that dropped the receiver would not have failed a test.
  it("calls back with the context it was given as receiver", () =>
    settle<void>((resolve, reject) => {
      const context = { marker: "the-receiver" };

      waterfall(
        [passthrough()],
        [{ data: "foobar" }],
        function assertsItsReceiver(this: typeof context) {
          try {
            expect(this).toBe(context);
            resolve();
          } catch (assertion) {
            reject(assertion);
          }
        },
        context,
      );
    }));
});
