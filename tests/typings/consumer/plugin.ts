/**
 * A plugin, written as the plugin guides write one: `init` stores the config
 * and the context, and every other method uses them.
 */

import type { JSONObject, KuzzleRequest, PluginContext } from "kuzzle";
import { Plugin } from "kuzzle";

export class MailerPlugin extends Plugin {
  private sent = 0;

  constructor() {
    super({ kuzzleVersion: ">=2.8.0 <3" });

    this.api = {
      mailer: {
        actions: {
          send: {
            handler: (request: KuzzleRequest) => this.send(request),
            http: [{ path: "/mailer/send", verb: "post" }],
          },
        },
      },
    };

    this.hooks = {
      "document:afterCreate": async (request: KuzzleRequest) => {
        this.context.log.info(`created in ${request.input.args.index}`);
      },
      "server:afterNow": [async () => {}, async () => this.onNow()],
    };

    this.pipes = {
      "document:beforeCreate": [async (request: KuzzleRequest) => request],
      "server:afterNow": async (request: KuzzleRequest) => request,
    };

    this.authenticators = { Local: class {} };

    this.strategies = {
      local: {
        config: { authenticator: "Local", fields: ["login", "password"] },
        methods: {
          create: "create",
          delete: "delete",
          exists: "exists",
          update: "update",
          validate: "validate",
          verify: "verify",
        },
      },
    };
  }

  async init(config: JSONObject, context: PluginContext) {
    this.config = config;
    this.context = context;

    this.context.log.info("mailer ready");

    const request = new context.constructors.Request({
      action: "now",
      controller: "server",
    });
    const derived = new context.constructors.Request(request, {
      action: "info",
      controller: "server",
    });
    const input = new context.constructors.RequestInput({
      action: "b",
      controller: "a",
    });
    const requestContext = new context.constructors.RequestContext({});
    const koncorde = new context.constructors.Koncorde();
    const mutex = new context.constructors.Mutex("mailer");

    return { derived, input, koncorde, mutex, requestContext };
  }

  // TY-01: `this.context` and `this.config` outside `init`.
  async send(request: KuzzleRequest) {
    this.sent++;
    this.context.log.info(`sending #${this.sent}`);

    const sdk = this.context.accessors.sdk;
    await sdk.document.create("mails", "outbox", request.getBody());

    const from: string = this.config.from;

    return { from, sent: this.sent };
  }

  // TY-02: `accessors.execute` without a callback is a promise of the request.
  async now() {
    const request = new this.context.constructors.Request({
      action: "now",
      controller: "server",
    });

    const status: number = (await this.context.accessors.execute(request))
      .status;
    const result = await this.context.accessors
      .execute(request)
      .then((answered) => answered.result);
    const withNull = await this.context.accessors.execute(request, null);

    // The callback form answers through the callback. It returns nothing at
    // runtime, but v2.56.0 declared a promise, so chaining compiled then and
    // must still compile.
    this.context.accessors.execute(request, (error: Error | null) => {
      if (error) {
        this.context.log.error(error.message);
      }
    });
    const chained: Promise<unknown> = this.context.accessors
      .execute(request, () => {})
      .then((answered) => answered.status);

    await this.context.accessors.trigger("mailer:now", { status });

    return { chained, result, status: withNull.status };
  }

  onNow() {
    this.context.log.debug("now");
  }
}

// A plugin that re-declares the fields, the workaround some plugins used
// while the base class declared them optional.
export class DeclaringPlugin extends Plugin {
  declare context: PluginContext;
  declare config: JSONObject;

  constructor() {
    super({ kuzzleVersion: ">=2" });
  }

  async init(config: JSONObject, context: PluginContext) {
    this.config = config;
    this.context = context;
  }

  later() {
    return this.context.accessors.sdk.server.now({});
  }
}

// TD-12: the context's untyped members, read without narrowing, and replaced
// the way a plugin's unit tests stub them — with narrower parameters.
type Mail = { to: string };

class MailRepository {
  constructor(
    readonly collection: string,
    readonly objectConstructor: new () => Mail,
  ) {}
  create = async (document: JSONObject) => document;
  createOrReplace = async (document: JSONObject) => document;
  delete = async (id: string) => id;
  get = async (id: string) => id;
  mGet = async (ids: string[]) => ids;
  replace = async (document: JSONObject) => document;
  search = async (query: JSONObject) => query;
  update = async (document: JSONObject) => document;
}

export async function untypedContext(context: PluginContext, raw: unknown) {
  const repository = new context.constructors.Repository("mails", raw);
  const mail: Mail = await repository.get("id");
  const found: { total: number } = await repository.search({}, raw);
  const piped: Mail = await context.accessors.trigger("sent", raw);
  const client: { ping(): Promise<boolean> } =
    new context.constructors.ESClient();
  const notFound: Error = new context.errors.NotFoundError("gone");
  const wrapped: Error = context.kerror.get("some_error", raw);
  const valid: boolean = await context.accessors.validation.validate(raw);

  await context.accessors.strategies.add("local", raw);
  await context.accessors.storage.createCollection("mails", raw);
  await context.accessors.storage.bootstrap(raw);
  context.log.info(raw);

  const stubs: PluginContext = {
    ...context,
    accessors: {
      ...context.accessors,
      storage: {
        bootstrap: async (collections: JSONObject) => {
          context.log.debug(collections);
        },
        createCollection: async (collection: string, mappings: JSONObject) => {
          context.log.debug({ collection, mappings });
        },
      },
      strategies: {
        add: async (name: string, properties: JSONObject) => {
          context.log.debug({ name, properties });
        },
        remove: async () => {},
      },
      trigger: async (event: string, payload: Mail) => payload,
    },
    constructors: { ...context.constructors, Repository: MailRepository },
    log: { ...context.log, info: (message: string) => message.length },
  };

  return { client, found, mail, notFound, piped, stubs, valid, wrapped };
}
