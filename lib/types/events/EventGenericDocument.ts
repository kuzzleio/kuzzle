import type { KDocument, KDocumentContent, JSONObject } from "kuzzle-sdk";

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
  // The parameter used to be unconstrained AND named `KDocumentContent`, which
  // shadowed the SDK's constraint of the same name rather than satisfying it.
  TContent extends KDocumentContent,
> = {
  name: `generic:document:${name}`;

  args: [KDocument<TContent>[], KuzzleRequest];
};

export type EventGenericDocumentBeforeWrite<
  TContent extends KDocumentContent = JSONObject,
> = EventGenericDocument<"beforeWrite", TContent>;

export type EventGenericDocumentAfterWrite<
  TContent extends KDocumentContent = JSONObject,
> = EventGenericDocument<"afterWrite", TContent>;

export type EventGenericDocumentBeforeUpdate<
  TContent extends KDocumentContent = JSONObject,
> = EventGenericDocument<"beforeUpdate", TContent>;

export type EventGenericDocumentAfterUpdate<
  TContent extends KDocumentContent = JSONObject,
> = EventGenericDocument<"afterUpdate", TContent>;

export type EventGenericDocumentAfterGet<
  TContent extends KDocumentContent = JSONObject,
> = EventGenericDocument<"afterGet", TContent>;

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
