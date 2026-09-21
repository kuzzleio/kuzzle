import { describe, expect, it } from "vitest";

import waterfall from "../../../lib/kuzzle/event/waterfall";

/**
 * `waterfall` reports through a callback invoked with an explicit `this`, and
 * the Mocha spec used its `done` for both — `context = { done }`, then
 * `this.done()` from the callback. vitest has no `done`, so each test returns
 * a promise instead and `context` keeps only what the subject is given: the
 * receiver the callback is called with.
 *
 * `settle` is what preserves the one property the `done` form had for free —
 * a test that never calls back **fails** rather than passing silently — since
 * a promise that is never settled is a timeout, not a success.
 */
const settle = <T>(
  run: (resolve: (value: T) => void, reject: (error: unknown) => void) => void,
) => new Promise<T>(run);

describe("#kuzzle/event/waterfall", () => {
  it("chains callbacks and passes the result along", () =>
    settle<void>((resolve, reject) => {
      const chain = [
        (data, cb) => cb(null, data),
        (data, cb) => cb(null, data),
      ];

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
      const step = (...args) => {
        const cb = args.pop();
        cb(null, ...args);
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
      const chain = [
        (data, cb) => {
          ran.push("first");
          cb(null, data);
        },
        undefined,
        (data, cb) => {
          ran.push("third");
          cb(null, data);
        },
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
      const chain = [
        (data, cb) => {
          ran.push("first");
          cb(new Error("error"), data);
        },
        (data, cb) => {
          ran.push("second");
          cb(null, data);
        },
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
        [
          (data: unknown, cb: (e: unknown, d: unknown) => void) =>
            cb(null, data),
        ],
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
