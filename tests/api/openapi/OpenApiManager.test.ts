import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenApiManager } from "../../../lib/api/openapi/OpenApiManager";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/*
 * The Mocha spec sat at `test/api/OpenApiManager.test.js` while the subject is
 * `lib/api/openapi/OpenApiManager.ts`. The `tests/` mirror convention is what
 * assigns a file its owning coverage report (`prepare-coverage.ts`), so the
 * port moves the spec under `openapi/` — otherwise it would run, pass, and
 * count for nothing.
 */
describe("#api/openapi/OpenApiManager", () => {
  let manager: OpenApiManager;
  let onAsk: ReturnType<typeof vi.fn>;

  const applicationOpenApi = {
    externalDocs: {
      description: "Kuzzle API Documentation",
      url: "https://docs.kuzzle.io/core/2/api/",
    },
    info: {
      contact: {
        discord: "http://join.discord.kuzzle.io",
        email: "support@kuzzle.io",
        name: "Kuzzle team",
        url: "https://kuzzle.io",
      },
      description: "Kuzzle HTTP API definition",
      license: {
        name: "Apache 2",
        url: "http://opensource.org/licenses/apache2.0",
      },
      title: "Kuzzle API",
      version: "1.42.42",
    },
    paths: {},
    schemes: ["https", "http"],
    swagger: "2.0",
    tags: [],
  };

  const pluginsRoutes = [
    {
      action: "patch",
      controller: "logistic-objects",
      openapi: {
        description: "Creates a new Logistic Object",
        parameters: [
          {
            description: "Type of the Logistic Object",
            in: "url",
            name: "type",
            required: true,
          },
        ],
      },
      path: "/logistic-objects/patch",
      verb: "PATCH",
    },
  ];

  const kuzzleRoutes = [
    {
      action: "nativeAction",
      controller: "nativeController",
      path: "/nativeController/nativeAction",
      verb: "GET",
    },
    {
      action: "exists",
      controller: "collection",
      path: "/:index/:collection/_exists",
      verb: "get",
    },
  ];

  beforeEach(() => {
    /*
     * The manager builds both definitions in its constructor and exposes them
     * through two ask events. `onAsk` is the whole fixture: nothing here reads
     * config, storage or anything else off the global.
     */
    onAsk = vi.fn();
    stubKuzzle({ onAsk });

    manager = new OpenApiManager(
      applicationOpenApi as never,
      kuzzleRoutes as never,
      pluginsRoutes as never,
    );
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("builds a path for each kuzzle route", () => {
    expect(manager.kuzzleDefinition.paths).toHaveProperty(
      "/nativeController/nativeAction",
    );
  });

  it("builds a path for each plugin route", () => {
    expect(manager.applicationDefinition.paths).toHaveProperty(
      "/logistic-objects/patch",
    );
  });

  it("lowercases a route's verb", () => {
    expect(
      manager.kuzzleDefinition.paths["/nativeController/nativeAction"],
    ).toHaveProperty("get");
  });

  it("rewrites the :param notation as {param}", () => {
    expect(manager.kuzzleDefinition.paths).toHaveProperty(
      "/{index}/{collection}/_exists",
    );
  });

  it("declares a path parameter for each placeholder", () => {
    expect(
      manager.kuzzleDefinition.paths["/{index}/{collection}/_exists"].get
        .parameters,
    ).toMatchObject([
      { in: "path", name: "index" },
      { in: "path", name: "collection" },
    ]);
  });

  it("tags a plugin route with its controller", () => {
    const route =
      manager.applicationDefinition.paths["/logistic-objects/patch"].patch;

    expect(route.tags[0]).toBe("logistic-objects");
  });

  it("exposes both definitions as ask events", () => {
    expect(onAsk.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining([
        "core:api:openapi:kuzzle",
        "core:api:openapi:app",
      ]),
    );
  });

  /*
   * Not covered by the Mocha spec, which asserted only that the events were
   * registered: nothing checked that the handlers hand back the definitions
   * every assertion above is about.
   */
  it("answers each ask event with the matching definition", () => {
    const handlerFor = (event: string) =>
      onAsk.mock.calls.find(([name]) => name === event)?.[1] as () => unknown;

    expect(handlerFor("core:api:openapi:kuzzle")()).toBe(
      manager.kuzzleDefinition,
    );
    expect(handlerFor("core:api:openapi:app")()).toBe(
      manager.applicationDefinition,
    );
  });
});
