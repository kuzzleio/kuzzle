import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Backend } from "../../../lib/core/backend/backend";
import type { Controller, ControllerDefinition } from "../../../lib/types";
import { createBackend, internals } from "./backendFixture";

vi.mock("../../../lib/kuzzle", async () => {
  const { FakeKuzzle } = await import("./fakeKuzzle");

  return { Kuzzle: FakeKuzzle, default: FakeKuzzle };
});

const definitionOf = (): ControllerDefinition => ({
  actions: {
    sayHello: {
      handler: async (request) => `Hello, ${request.input.args.name}`,
      http: [
        {
          verb: "post",
          path: "/greeting/hello/:name",
          openapi: {
            parameters: [
              {
                in: "path",
                name: "name",
                schema: { type: "string" },
                required: true,
              },
            ],
            responses: {
              200: {
                description: "Custom greeting",
                content: {
                  "application/json": { schema: { type: "string" } },
                },
              },
            },
          },
        },
      ],
    },
    sayBye: {
      handler: async (request) => `Bye ${request.input.args.name}!`,
    },
  },
});

describe("BackendController", () => {
  let application: Backend;

  beforeEach(async () => {
    application = await createBackend();
    application.config.content.controllers.definition.allowAdditionalActionProperties = false;
  });

  describe("#register", () => {
    let definition: ControllerDefinition;

    beforeEach(() => {
      definition = definitionOf();
    });

    it("registers a new controller definition", () => {
      application.controller.register("greeting", definition);

      expect(internals(application)._controllers.greeting).toBe(definition);
    });

    it("rejects a name that is already taken", () => {
      application.controller.register("greeting", definition);

      expect(() =>
        application.controller.register("greeting", definitionOf()),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_controller_definition",
        }),
      );
    });

    it("checks the controller definition", () => {
      delete (definition as { actions?: unknown }).actions;

      expect(() =>
        application.controller.register("greeting", definition),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_controller_definition",
        }),
      );
    });

    it("rejects additional action properties", () => {
      (definition.actions.sayHello as { foo?: string }).foo = "bar";

      expect(() =>
        application.controller.register("greeting", definition),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_controller_definition",
        }),
      );
    });

    it("accepts additional action properties when the config allows it", () => {
      application.config.content.controllers.definition.allowAdditionalActionProperties = true;
      (definition.actions.sayHello as { foo?: string }).foo = "bar";

      expect(() =>
        application.controller.register("greeting", definition),
      ).not.toThrow();
    });
  });

  describe("#use", () => {
    class GreetingController {
      public name?: string;
      public definition: ControllerDefinition;

      constructor() {
        this.definition = { actions: { sayHello: { handler: this.sayHello } } };
      }

      async sayHello() {}
    }

    const asController = (instance: object) =>
      instance as unknown as Controller;
    let controller: GreetingController;

    beforeEach(() => {
      controller = new GreetingController();
    });

    it("uses a controller instance, binding its handler to it", () => {
      application.controller.use(asController(controller));

      expect(
        internals(application)._controllers.greeting.actions.sayHello.handler
          .name,
      ).toBe("bound sayHello");
    });

    it("uses the name property for the controller name", () => {
      controller.name = "bonjour";

      application.controller.use(asController(controller));

      expect(internals(application)._controllers.bonjour).not.toBeUndefined();
    });

    it("rejects a handler that is not a function", () => {
      (controller.definition.actions.sayHello as { handler: unknown }).handler =
        {};

      expect(() =>
        application.controller.use(asController(controller)),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_controller_definition",
        }),
      );
    });

    it("rejects a name that is already taken", () => {
      application.controller.use(asController(controller));

      expect(() =>
        application.controller.use(asController(new GreetingController())),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_controller_definition",
        }),
      );
    });

    it("checks the controller definition", () => {
      delete (controller.definition as { actions?: unknown }).actions;

      expect(() =>
        application.controller.use(asController(controller)),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_controller_definition",
        }),
      );
    });

    it("rejects additional action properties", () => {
      (controller.definition.actions.sayHello as { foo?: string }).foo = "bar";

      expect(() =>
        application.controller.use(asController(controller)),
      ).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_controller_definition",
        }),
      );
    });

    it("accepts additional action properties when the config allows it", () => {
      application.config.content.controllers.definition.allowAdditionalActionProperties = true;
      (controller.definition.actions.sayHello as { foo?: string }).foo = "bar";

      expect(() =>
        application.controller.use(asController(controller)),
      ).not.toThrow();
    });
  });
});
