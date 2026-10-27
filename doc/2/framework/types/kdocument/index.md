---
code: false
type: page
title: KDocument | Framework | Core

description: KDocument, KDocumentContent and KHit type definitions
---

# KDocument

<SinceBadge version="2.58.0" />

The `KDocument` type represents a document stored in Kuzzle. It takes the type of the document content as a type argument.

It replaces the deprecated `KuzzleDocument` type, and the deprecated `Document`, `DocumentContent`, `DocumentMetadata` and `DocumentHit` types.

These types come from the [kuzzle-types](https://github.com/kuzzleio/types) package, shared with the Javascript SDK (see [API contract types](/core/2/framework/types/api-contract-types)). They are the same types as the ones `kuzzle-sdk` exports under the same names.

## KDocument

```ts
interface KDocument<TKDocumentContent extends KDocumentContent> {
  _id: string;
  _source: TKDocumentContent;
  created?: boolean;
  _version?: number;
}
```

| Property   | Type                           | Description                                                                         |
| ---------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| `_id`      | <pre>string</pre>              | Document unique identifier                                                          |
| `_source`  | <pre>TKDocumentContent</pre>   | Document content                                                                    |
| `created`  | <pre>boolean</pre>             | (optional) For an upsert: `true` if the document was created, `false` if it was updated |
| `_version` | <pre>number</pre>              | (optional) Document version                                                         |

## KDocumentContent

Base type of a document content: the content type passed to `KDocument` must extend it.

```ts
interface KDocumentContent {
  _kuzzle_info?: KDocumentKuzzleInfo;
}

interface KDocumentKuzzleInfo {
  author: string;           // kuid of the user who created the document
  createdAt: number;        // creation date (Epoch-millis)
  updater: string | null;   // kuid of the user who last updated the document
  updatedAt: number | null; // last update date (Epoch-millis)
}
```

`KDocumentContentGeneric` is a `KDocumentContent` that also accepts any other property, for a document whose content is not typed.

## KHit

The `KHit` type represents a document returned by a search. It extends `KDocument`.

| Property     | Type              | Description                                                       |
| ------------ | ----------------- | ----------------------------------------------------------------- |
| `_score`     | <pre>number</pre> | Relevance score                                                   |
| `index`      | <pre>string</pre> | (optional) Document index. Only set by a multi-collection search  |
| `collection` | <pre>string</pre> | (optional) Document collection. Only set by a multi-collection search |

**Example:**

```ts
import { KDocument, KDocumentContent } from 'kuzzle';

interface DeviceContent extends KDocumentContent {
  model: string;
  battery: number;
}

const device: KDocument<DeviceContent> = await app.sdk.document.get<DeviceContent>(
  'iot',
  'devices',
  'device-1'
);

app.log.info(`${device._source.model}: ${device._source.battery}%`);
```
