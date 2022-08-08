"use strict";

const should = require("should");

const KuzzleMock = require("../mocks/kuzzle.mock");

const { OpenApiManager } = require("../../lib/api/openapi/OpenApiManager");

describe("OpenApiManager", () => {
  let applicationOpenApi;
  let kuzzleRoutes;
  let pluginsRoutes;
  let manager;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    applicationOpenApi = {
      swagger: "2.0",
      info: {
        title: "Kuzzle API",
        description: "Kuzzle HTTP API definition",
        contact: {
          name: "Kuzzle team",
          url: "https://kuzzle.io",
          email: "support@kuzzle.io",
          discord: "http://join.discord.kuzzle.io",
        },
        license: {
          name: "Apache 2",
          url: "http://opensource.org/licenses/apache2.0",
        },
        version: "1.42.42",
      },
      externalDocs: {
        description: "Kuzzle API Documentation",
        url: "https://docs.kuzzle.io/core/2/api/",
      },
      servers: [
        {
          url: "https://{baseUrl}:{port}",
          description: "Kuzzle Base Url",
          variables: {
            baseUrl: { default: "localhost" },
            port: { default: 7512 },
          },
        },
      ],
      tags: [],
      schemes: ["https", "http"],
      paths: {},
      components: {},
    };

    pluginsRoutes = [
      {
        action: "patch",
        controller: "logistic-objects",
        path: "/logistic-objects/patch",
        verb: "PATCH",
        openapi: {
          description: "Creates a new Logistic Object",
          parameters: [
            {
              in: "url",
              name: "type",
              description: "Type of the Logistic Object",
              required: true,
            },
          ],
        },
      },
    ];

    kuzzleRoutes = [
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

    manager = new OpenApiManager(
      applicationOpenApi,
      kuzzleRoutes,
      pluginsRoutes
    );
  });

  describe("#constructor", () => {
    it("should generate open API paths from kuzzle routes", () => {
      should(manager.kuzzleDefinition.paths).have.ownProperty(
        "/nativeController/nativeAction"
      );
    });

    it("should generate open API paths from kuzzle routes", () => {
      should(manager.applicationDefinition.paths).have.ownProperty(
        "/logistic-objects/patch"
      );
    });

    it("should make sure that route verbs are lowercase only", () => {
      should(manager.kuzzleDefinition.paths).have.ownProperty(
        "/nativeController/nativeAction"
      );
      should(
        manager.kuzzleDefinition.paths["/nativeController/nativeAction"]
      ).have.ownProperty("get");
    });

    it("should transform our :param path notation to {param}", () => {
      should(manager.kuzzleDefinition.paths).have.ownProperty(
        "/{index}/{collection}/_exists"
      );
    });

    it("should extract parameters when required", () => {
      should(manager.kuzzleDefinition.paths).have.ownProperty(
        "/{index}/{collection}/_exists"
      );
      should(
        manager.kuzzleDefinition.paths["/{index}/{collection}/_exists"].get
          .parameters
      ).match([
        { name: "index", in: "path" },
        { name: "collection", in: "path" },
      ]);
    });

    it("should inject controller tags on already defined open api spec", () => {
      const routeDefinition =
        manager.applicationDefinition.paths["/logistic-objects/patch"].patch;
      should(routeDefinition.tags[0]).be.exactly("logistic-objects");
    });

    it("should register ask events", () => {
      should(kuzzle.onAsk).be.calledWith("core:api:openapi:kuzzle");
      should(kuzzle.onAsk).be.calledWith("core:api:openapi:app");
    });
  });
});
