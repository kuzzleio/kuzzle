import {
  KuzzleRequest,
  KDocument,
  JSONObject,
  PipeEventHandler,
} from "../../../";

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
type EventGenericDocument<name extends string, KDocumentContent> = {
  name: `generic:document:${name}`;

  args: [KDocument<KDocumentContent>[], KuzzleRequest];
};

export type EventGenericDocumentBeforeWrite<KDocumentContent = JSONObject> =
  EventGenericDocument<"beforeWrite", KDocumentContent>;

export type EventGenericDocumentAfterWrite<KDocumentContent = JSONObject> =
  EventGenericDocument<"afterWrite", KDocumentContent>;

export type EventGenericDocumentBeforeUpdate<KDocumentContent = JSONObject> =
  EventGenericDocument<"beforeUpdate", KDocumentContent>;

export type EventGenericDocumentAfterUpdate<KDocumentContent = JSONObject> =
  EventGenericDocument<"afterUpdate", KDocumentContent>;

export type EventGenericDocumentAfterGet<KDocumentContent = JSONObject> =
  EventGenericDocument<"afterGet", KDocumentContent>;

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
