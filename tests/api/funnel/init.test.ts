import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Per-module imports, not the `lib/api/controllers` barrel: that barrel is
 * `export =` an object literal, which TS2497 refuses to reference from an ES
 * import. Each controller module is `export =` a class, which is importable.
 */
import AdminController from "../../../lib/api/controllers/adminController";
import AuthController from "../../../lib/api/controllers/authController";
import BulkController from "../../../lib/api/controllers/bulkController";
import ClusterController from "../../../lib/api/controllers/clusterController";
import CollectionController from "../../../lib/api/controllers/collectionController";
import { DebugController } from "../../../lib/api/controllers/debugController";
import DocumentController from "../../../lib/api/controllers/documentController";
import IndexController from "../../../lib/api/controllers/indexController";
import MemoryStorageController from "../../../lib/api/controllers/memoryStorageController";
import RealtimeController from "../../../lib/api/controllers/realtimeController";
import SecurityController from "../../../lib/api/controllers/securityController";
import ServerController from "../../../lib/api/controllers/serverController";
import Funnel from "../../../lib/api/funnel";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/funnel.init", () => {
  let funnel: Funnel;
  let onAsk: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    /*
     * `init()` is the one method here that really does touch the application:
     * it registers two ask events and then constructs the thirteen native
     * controllers, each of which reads its own slice of the config. So this
     * fixture is not "a small mock" by taste — it is the list of everything
     * the thirteen constructors reach for, which is exactly what KuzzleMock
     * hid.
     */
    onAsk = vi.fn();
    stubKuzzle({
      onAsk,
      /*
       * `AuthController.init()` is the only controller that asks anything
       * during init, and it dereferences the answer — so the anonymous user
       * has to come back with an `_id`.
       */
      ask: async (event: string) =>
        event === "core:security:user:anonymous:get"
          ? { _id: "-1" }
          : undefined,
      pipe: async () => undefined,
      pluginsManager: { getStrategyMethod: () => undefined },
      config: {
        dump: { enabled: false, handledErrors: {} },
        http: { cookieAuthentication: false, routes: [] },
        internal: { allowAllOrigins: true, notifiableProtocols: [] },
        limits: {
          concurrentRequests: 100,
          documentsFetchCount: 100,
          documentsWriteCount: 200,
          loginsPerSecond: 1,
          requestsBufferSize: 50000,
          requestsBufferWarningThreshold: 5000,
        },
        plugins: { common: { failsafeMode: false } },
        security: { restrictedProfileIds: [], standard: {} },
        server: { strictSdkVersion: false },
        services: { storageEngine: { defaults: { scrollTTL: "15s" } } },
        version: "2.56.0",
      },
    });
    funnel = new Funnel();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("registers the two ask events the funnel answers", async () => {
    await funnel.init();

    expect(onAsk.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining([
        "kuzzle:api:funnel:controller:isNative",
        "kuzzle:api:funnel:metrics",
      ]),
    );
  });

  it("starts the rate limiter", async () => {
    const init = vi.spyOn(funnel.rateLimiter, "init");

    await funnel.init();

    expect(init).toHaveBeenCalledTimes(1);
  });

  it("registers the thirteen native controllers under their names", async () => {
    await funnel.init();

    expect(funnel.controllers.size).toBe(13);
    expect(funnel.controllers.get("admin")).toBeInstanceOf(AdminController);
    expect(funnel.controllers.get("auth")).toBeInstanceOf(AuthController);
    expect(funnel.controllers.get("bulk")).toBeInstanceOf(BulkController);
    expect(funnel.controllers.get("cluster")).toBeInstanceOf(ClusterController);
    expect(funnel.controllers.get("collection")).toBeInstanceOf(
      CollectionController,
    );
    expect(funnel.controllers.get("debug")).toBeInstanceOf(DebugController);
    expect(funnel.controllers.get("document")).toBeInstanceOf(
      DocumentController,
    );
    expect(funnel.controllers.get("index")).toBeInstanceOf(IndexController);
    expect(funnel.controllers.get("memoryStorage")).toBeInstanceOf(
      MemoryStorageController,
    );
    expect(funnel.controllers.get("realtime")).toBeInstanceOf(
      RealtimeController,
    );
    expect(funnel.controllers.get("security")).toBeInstanceOf(
      SecurityController,
    );
    expect(funnel.controllers.get("server")).toBeInstanceOf(ServerController);
  });

  /*
   * Not asserted by the Mocha spec, and the reason `ms` exists at all: the two
   * names are the *same* instance, not two controllers that happen to be of
   * the same class. `toBeInstanceOf` on each would pass with two.
   */
  it("exposes the memoryStorage controller under both of its names", async () => {
    await funnel.init();

    expect(funnel.controllers.get("ms")).toBe(
      funnel.controllers.get("memoryStorage"),
    );
  });
});
