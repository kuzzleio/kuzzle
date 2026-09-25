/**
 * An application, written as the guides write one: a `Backend` with its
 * controllers, pipes, hooks, imports and plugins, then what it does once
 * started.
 */

import { Readable } from "stream";

import type {
  ControllerDefinition,
  EmbeddedSDK,
  EventGenericDocumentBeforeWrite,
  HookEventHandler,
  HttpRoute,
  KuzzleRequest,
  PipeEventHandler,
  PluginHookDefinition,
  PluginPipeDefinition,
} from "kuzzle";
import {
  Backend,
  HttpStream,
  Inflector,
  Koncorde,
  KuzzleRequest as Request,
  Mutex,
  NameGenerator,
  PreconditionError,
  RequestContext,
  RequestInput,
} from "kuzzle";

import { MailerPlugin } from "./plugin";

const app = new Backend("typings");

app.config.set("plugins.common.maxConcurrentPipes", 200);

app.vault.key = "secret-key";
app.vault.file = "secrets.enc.json";

export const version: string = app.version;

app.controller.register("greeting", {
  actions: {
    options: {
      handler: async () => null,
      http: [{ path: "/opt", verb: "options" }],
    },
    sayHello: {
      handler: async (request: KuzzleRequest) => {
        if (request.input.args.name === undefined) {
          throw new PreconditionError('Missing "name" argument.');
        }

        return `Hello, ${request.input.args.name}`;
      },
      http: [
        { path: "/greeting/hello/:name", verb: "post" },
        {
          openapi: { description: "Simply say hello" },
          path: "greeting/hello/:name",
          verb: "get",
        },
      ],
    },
    stream: {
      handler: async () =>
        new HttpStream(Readable.from(["a", "b"]), { totalBytes: 2 }),
      http: [{ path: "/stream", verb: "get" }],
    },
  },
});

const definition: ControllerDefinition = {
  actions: { a: { handler: async (req: KuzzleRequest) => req.getBody() } },
};
app.controller.register("defined", definition);

export const route: HttpRoute = { path: "/x", verb: "patch" };

app.pipe.register("server:afterNow", async (request: KuzzleRequest) => {
  request.result.now = Date.now();
  return request;
});
app.pipe.register<EventGenericDocumentBeforeWrite>(
  "generic:document:beforeWrite",
  async (documents) => documents,
);

const pipeId = app.pipe.register(
  "server:afterNow",
  async (request) => request,
  {
    dynamic: true,
  },
);
if (pipeId) {
  app.pipe.unregister(pipeId);
}

app.hook.register("request:onError", async (request: KuzzleRequest) => {
  app.log.error(request.error);
});
app.hook.register("core:kuzzleStart", () => {
  app.log.info("started");
});

export const customPipe: PipeEventHandler = async (payload) => payload;
export const customHook: HookEventHandler = () => {};
export const hookDefinition: PluginHookDefinition = { "a:b": async () => {} };
export const pipeDefinition: PluginPipeDefinition = {
  "a:b": async (request: KuzzleRequest) => request,
};

app.import.mappings({
  nyc: { taxi: { mappings: { properties: { name: { type: "keyword" } } } } },
});
app.import.profiles({ driver: { policies: [{ roleId: "driver" }] } });
app.import.roles({
  driver: { controllers: { document: { actions: { create: true } } } },
});
app.import.userMappings({ properties: { name: { type: "keyword" } } });
app.import.users(
  { driver: { content: { profileIds: ["driver"] } } },
  { onExistingUsers: "overwrite" },
);

app.cluster.on("my-event", (payload) => {
  app.log.info(payload);
});
app.install("id", async () => {}, "desc");

app.plugin.use(new MailerPlugin());
app.plugin.use(new MailerPlugin(), { name: "other" });
export const other = app.plugin.get<MailerPlugin>("other");

export const fromScratch = new Request(
  { action: "create", controller: "document" },
  { user: null },
);
export const input = new RequestInput({ controller: "a" });
export const requestContext = new RequestContext({
  connection: { protocol: "http" },
});
export const koncorde = new Koncorde();

async function afterStart() {
  await app.cluster.broadcast("my-event", { some: "payload" });
  await app.sdk.document.create("nyc", "taxi", { age: 27, name: "Aschen" });

  const sdk: EmbeddedSDK = app.sdk;
  const answer = await sdk.query({
    action: "sayHello",
    controller: "greeting",
  });
  const documents = await sdk.document.search("nyc", "taxi", { query: {} });

  const mutex = new Mutex("resource", { timeout: 1000, ttl: 5000 });
  if (await mutex.lock()) {
    await mutex.unlock();
  }

  const name: string = NameGenerator.generateRandomName();
  const kebab: string = Inflector.kebabCase("FooBar");

  return { answer, documents, kebab, name };
}

app
  .start()
  .then(afterStart)
  .catch((error: Error) => app.log.error(error.message));
