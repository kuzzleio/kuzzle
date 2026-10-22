/**
 * TD-08: the event types under `lib/types/events/`. Nothing inside Kuzzle
 * references them, because they are not for Kuzzle: each one names an event
 * the server does emit, and an application hands it to `register<T>()` to type
 * its handler. These registrations are how they are meant to be used, and keep
 * every one of them on the public surface.
 *
 * Plus the three `lib/types/` files renamed to PascalCase by the same entry,
 * still reachable by a deep import of their old `dist/lib/...` path.
 */

import type {
  EventGenericDocumentAfterDelete,
  EventGenericDocumentAfterGet,
  EventGenericDocumentAfterUpdate,
  EventGenericDocumentAfterWrite,
  EventGenericDocumentBeforeDelete,
  EventGenericDocumentBeforeGet,
  EventGenericDocumentBeforeUpdate,
  EventGenericDocumentBeforeWrite,
  EventGenericDocumentInjectMetadata,
  EventHTTPAfterParsingPayload,
  EventHTTPBeforeParsingPayload,
  EventWebsocketAfterParsingPayload,
  EventWebsocketBeforeParsingPayload,
} from "kuzzle";
import { Backend } from "kuzzle";
import type { ResetSecurityResult } from "kuzzle/dist/lib/types/controllers/adminController.type";
import type { GetCurrentUserResponse } from "kuzzle/dist/lib/types/controllers/authController.type";
import type {
  Serializable,
  Serialized,
} from "kuzzle/dist/lib/types/core/auth/formatProcessing.type";

type Car = { brand: string };

const app = new Backend("events");

app.pipe.register<EventGenericDocumentBeforeGet>(
  "generic:document:beforeGet",
  async (ids) => ids.map(({ _id }) => ({ _id })),
);
app.pipe.register<EventGenericDocumentAfterGet<Car>>(
  "generic:document:afterGet",
  async (documents) => documents.filter((d) => d._source.brand !== ""),
);
app.pipe.register<EventGenericDocumentBeforeWrite<Car>>(
  "generic:document:beforeWrite",
  async (documents) => documents,
);
app.pipe.register<EventGenericDocumentAfterWrite<Car>>(
  "generic:document:afterWrite",
  async (documents) => documents,
);
app.pipe.register<EventGenericDocumentBeforeUpdate<Car>>(
  "generic:document:beforeUpdate",
  async (documents) => documents,
);
app.pipe.register<EventGenericDocumentAfterUpdate<Car>>(
  "generic:document:afterUpdate",
  async (documents) => documents,
);
app.pipe.register<EventGenericDocumentBeforeDelete>(
  "generic:document:beforeDelete",
  async (ids) => ids,
);
app.hook.register<EventGenericDocumentAfterDelete>(
  "generic:document:afterDelete",
  (ids, request) => {
    app.log.info(`${request.input.action}: ${ids.length} deleted`);
  },
);
app.pipe.register<EventGenericDocumentInjectMetadata>(
  "generic:document:injectMetadata",
  async (event) => ({
    ...event,
    metadata: { ...event.metadata, origin: "events" },
  }),
);

app.pipe.register<EventHTTPBeforeParsingPayload>(
  "protocol:http:beforeParsingPayload",
  async ({ message, payload }) => ({ message, payload }),
);
app.pipe.register<EventHTTPAfterParsingPayload>(
  "protocol:http:afterParsingPayload",
  async ({ message, payload }) => ({ message, payload: { ...payload } }),
);
app.pipe.register<EventWebsocketBeforeParsingPayload>(
  "protocol:websocket:beforeParsingPayload",
  async ({ connection, payload }) => ({ connection, payload }),
);
app.pipe.register<EventWebsocketAfterParsingPayload>(
  "protocol:websocket:afterParsingPayload",
  async ({ connection, payload }) => ({ connection, payload }),
);

// The deep imports: the names resolve, at the types they always had.
export function deepImports(
  me: GetCurrentUserResponse,
  reset: ResetSecurityResult,
  item: Serialized<Serializable>,
) {
  const id: string | null = me._id;
  const strategies: unknown = me.strategies;
  const source: Record<string, unknown> = item._source;

  return { deletedUsers: reset.deletedUsers, id, source, strategies };
}
