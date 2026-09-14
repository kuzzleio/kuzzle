import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above the module body, so everything they
// close over has to come from `vi.hoisted`.
const { calls, constructedWith, NotifierMock, HotelClerkMock } = vi.hoisted(
  () => {
    const initCalls: string[] = [];
    /** Constructor arguments, recorded so the back-reference can be asserted
     * without reaching into a private field. */
    const ctorArgs: Record<string, unknown> = {};

    return {
      calls: initCalls,
      constructedWith: ctorArgs,
      NotifierMock: class {
        constructor(module: unknown) {
          ctorArgs.notifier = module;
        }
        init = vi.fn(async () => {
          initCalls.push("notifier");
        });
      },
      HotelClerkMock: class {
        constructor(module: unknown) {
          ctorArgs.hotelClerk = module;
        }
        init = vi.fn(async () => {
          initCalls.push("hotelClerk");
        });
      },
    };
  },
);

// `notifier` ships `export =`, so the mock has to expose it as `default`;
// `hotelClerk` exports its class by name.
vi.mock("../../../lib/core/realtime/notifier", () => ({
  default: NotifierMock,
}));
vi.mock("../../../lib/core/realtime/hotelClerk", () => ({
  HotelClerk: HotelClerkMock,
}));

import RealtimeModule from "../../../lib/core/realtime";

type NotifierMock = InstanceType<typeof NotifierMock>;
type HotelClerkMock = InstanceType<typeof HotelClerkMock>;

describe("#core/realtime/RealtimeModule", () => {
  let module: RealtimeModule;

  beforeEach(() => {
    calls.length = 0;
    module = new RealtimeModule();
  });

  /** The mocks stand in for the real classes, so the declared types differ. */
  const notifier = () => module.notifier as unknown as NotifierMock;
  const hotelClerk = () => module.hotelClerk as unknown as HotelClerkMock;

  describe("#constructor", () => {
    it("instantiates the notifier and the hotel clerk", () => {
      expect(module.notifier).toBeInstanceOf(NotifierMock);
      expect(module.hotelClerk).toBeInstanceOf(HotelClerkMock);
    });

    it("passes itself to both, which is how they reach each other", () => {
      // notifier reads `this.module.hotelClerk.rooms` — that back-reference is
      // the whole point of this module.
      expect(constructedWith.notifier).toBe(module);
      expect(constructedWith.hotelClerk).toBe(module);
    });
  });

  describe("#init", () => {
    it("initialises the notifier before the hotel clerk", async () => {
      await module.init();

      expect(notifier().init).toHaveBeenCalledOnce();
      expect(hotelClerk().init).toHaveBeenCalledOnce();
      expect(calls).toEqual(["notifier", "hotelClerk"]);
    });

    it("rejects and stops if the notifier fails to initialise", async () => {
      notifier().init = vi.fn().mockRejectedValue(new Error("nope"));

      await expect(module.init()).rejects.toThrow("nope");
      expect(hotelClerk().init).not.toHaveBeenCalled();
    });
  });
});
