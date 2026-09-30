import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Service from "../../lib/service/service";
import { restoreKuzzle, stubKuzzle } from "../mocks/kuzzle";

describe("#service/Service", () => {
  const defaultInitTimeout = 120000;
  const name = "dummyService";

  /**
   * `Service` is **abstract** — `_initSequence` is the hook a real service
   * implements — and the Mocha spec instantiated it directly (TS2511 x 4).
   * A concrete subclass is both what type-checks and what a service is, so
   * the sequence is a `vi.fn` the tests can drive rather than a field they
   * assign onto the instance afterwards.
   */
  class TestService extends Service {
    public sequence = vi.fn(async () => undefined);

    protected _initSequence(): Promise<void> {
      return this.sequence();
    }
  }

  /** `_initTimeout` is the subject's own internal. */
  type ServiceInternals = { _initTimeout: number };

  beforeEach(() => {
    /*
     * One config key: the timeout a service falls back to when its own config
     * names none. That is the whole dependency.
     */
    stubKuzzle({ config: { services: { common: { defaultInitTimeout } } } });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const internalsOf = (service: Service) =>
    service as unknown as ServiceInternals;

  const serviceWith = (config: Record<string, unknown>) =>
    new TestService(name, config as never);

  describe("#constructor", () => {
    it("falls back to the shared timeout when the config names none", () => {
      const service = serviceWith({ some: "configuration" });

      expect(internalsOf(service)._initTimeout).toBe(defaultInitTimeout);
    });

    it("prefers the timeout its own config names", () => {
      const service = serviceWith({ initTimeout: 1000 });

      expect(internalsOf(service)._initTimeout).toBe(1000);
    });
  });

  describe("#init", () => {
    it("runs the init sequence", async () => {
      const service = serviceWith({});

      await service.init();

      expect(service.sequence).toHaveBeenCalledTimes(1);
    });

    it("rejects when the init sequence outlives the timeout", async () => {
      const service = serviceWith({ initTimeout: 10 });
      /* A sequence that never settles is what the timeout exists for. */
      // `Promise<undefined>`, which is what `sequence` is declared to
      // answer; `Promise<void>` is not the same type to an assignment.
      service.sequence = vi.fn(() => new Promise<undefined>(() => {}));

      await expect(service.init()).rejects.toMatchObject({
        id: "core.fatal.service_timeout",
      });
    });
  });
});
