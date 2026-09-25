/**
 * A controller class, typed pipes on the generic document events, a
 * repository, and the response headers.
 */

import type {
  EventGenericDocumentAfterGet,
  EventGenericDocumentAfterUpdate,
  EventGenericDocumentBeforeWrite,
  KuzzleRequest,
  RequestResponse,
} from "kuzzle";
import { Backend, Controller, ObjectRepository, cacheDbEnum } from "kuzzle";

const app = new Backend("typings");

// TY-07: `name` and `definition` read as a `string` and a definition.
export class EmailController extends Controller {
  constructor(backend: Backend) {
    super(backend);

    this.name = "email";
    this.definition = {
      actions: {
        send: {
          handler: this.send,
          http: [{ path: "/email/send", verb: "post" }],
        },
      },
    };
  }

  async send(request: KuzzleRequest) {
    const name: string = this.name;
    const actions = Object.keys(this.definition.actions).length;

    await this.app.sdk.document.create("idx", "col", request.getBody());

    return { actions, name };
  }
}

app.controller.use(new EmailController(app));

export function describe(controller: Controller): string {
  return `${controller.name}: ${Object.keys(controller.definition.actions)}`;
}

// TY-04: an application's own content types, interface and alias alike.
interface Car {
  brand: string;
  name: string;
}
type Truck = { load: number; name: string };

app.pipe.register<EventGenericDocumentAfterGet<Car>>(
  "generic:document:afterGet",
  async (documents) => {
    const brand: string = documents[0]._source.brand;
    app.log.debug(brand);
    return documents;
  },
);
app.pipe.register<EventGenericDocumentAfterUpdate<Truck>>(
  "generic:document:afterUpdate",
  async (documents) => documents,
);
app.pipe.register<EventGenericDocumentBeforeWrite<Car>>(
  "generic:document:beforeWrite",
  async (documents, request) => {
    app.log.debug(request.getController());
    return documents;
  },
);

// TY-07: a repository's loads resolve the object.
type Driver = { _id: string; name: string };

export class DriverRepository extends ObjectRepository<Driver> {
  constructor() {
    super({ cache: cacheDbEnum.NONE, store: { index: "drivers" } });
    this.collection = "drivers";
  }

  async nameOf(id: string) {
    const driver = await this.load(id);
    const name: string = driver.name;
    const cached = await this.loadFromCache(id);
    const stored = await this.loadOneFromDatabase(id);
    const found = await this.search({ query: {} });
    const total: number = found.total;
    const first: Driver = found.hits[0];

    return { cached: cached._id, first, name, stored: stored._id, total };
  }
}

// TY-07: a header read as v2.56.0 declared it.
export function header(response: RequestResponse): string {
  const value: string | null = response.getHeader("x-custom");

  if (value === null) {
    return "none";
  }

  return value.toUpperCase();
}
