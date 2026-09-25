import type { KDocument, KDocumentContent } from "kuzzle-sdk";
import type { JSONObject } from "../JSONObject";

import type { KuzzleRequest, PipeEventHandler } from "../../../index";

/**
 * Events with documents only having the `_id`
 */
type EventGenericDocumentPartial<name extends string> = {
  name: `generic:document:${name}`;

  args: [Array<{ _id: string }>, KuzzleRequest];
};

export type EventGenericDocumentBeforeDelete =
  EventGenericDocumentPartial<"beforeDelete">;

export type EventGenericDocumentAfterDelete =
  EventGenericDocumentPartial<"afterDelete">;

export type EventGenericDocumentBeforeGet =
  EventGenericDocumentPartial<"beforeGet">;

/**
 * Events having entire documents
 */
type EventGenericDocument<
  name extends string,
  // The parameter used to be named `KDocumentContent`, which shadowed the
  // SDK's constraint of the same name rather than satisfying it. It stays
  // unconstrained: `KDocumentContent` is a weak type (one optional member),
  // so `extends KDocumentContent` rejected any content type an application
  // declares — `EventGenericDocumentAfterGet<Car>` — which v2.56.0 accepted.
  // The intersection is what satisfies the SDK's constraint instead.
  TContent,
> = {
  name: `generic:document:${name}`;

  args: [KDocument<TContent & KDocumentContent>[], KuzzleRequest];
};

export type EventGenericDocumentBeforeWrite<TContent = JSONObject> =
  EventGenericDocument<"beforeWrite", TContent>;

export type EventGenericDocumentAfterWrite<TContent = JSONObject> =
  EventGenericDocument<"afterWrite", TContent>;

export type EventGenericDocumentBeforeUpdate<TContent = JSONObject> =
  EventGenericDocument<"beforeUpdate", TContent>;

export type EventGenericDocumentAfterUpdate<TContent = JSONObject> =
  EventGenericDocument<"afterUpdate", TContent>;

export type EventGenericDocumentAfterGet<TContent = JSONObject> =
  EventGenericDocument<"afterGet", TContent>;

export type EventGenericDocumentInjectMetadata = {
  name: `generic:document:injectMetadata`;

  args: [
    {
      /**
       * Kuzzle Request that triggered the event
       */
      request: KuzzleRequest;
      /**
       * Metadata of the document
       */
      metadata: JSONObject;
      /**
       * Default metadata of the document.
       * Only used when calling document:upsert.
       */
      defaultMetadata?: JSONObject;
    },
  ];
} & PipeEventHandler;
