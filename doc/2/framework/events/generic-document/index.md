---
type: page
code: false
title: Generic Document | Framework | Core

description: Generic document events list
order: 100
---

# Generic Document Events

Some actions in the document controller trigger generic events. Generic events can be used to apply modifications homogeneously on documents processed by this API controller, without having to write dedicated pipes for each action, independently.

There are 4 types of generic events, depending on the action performed on documents:
* get: when documents are fetched
* write: when documents are created or replaced
* update: when partial updates are applied to documents
* delete: when documents are deleted

As with other API events, generic ones are triggered before and after documents are processed:
* generic "before" events (`generic:document:before*`) are triggered **before** the regular `document:before*` events
* generic "after" events (`generic:document:after*`) are triggered **after** the regular `document:after*` events

All generic events cited before share the same payload signature, and pipes plugged to them must resolve to the updated (or not) array of documents received in their parameters.

::: info

"before" actions are only triggered on queries asking for specific documents. API action such as `document:search`, `document:deleteByQuery` or `document:updateByQuery` cannot trigger "before" events, they only trigger "after" ones.

:::

There are generic event that does not obey to the rules cited before:
* `generic:document:injectMetadata` is called before metadata (\_kuzzle\_info) are about to be injected in a document.

---

## generic:document:afterDelete

| Arguments   | Type                                                                                     | Description                                    |
| ----------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing document `_id`) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                     |

Triggered after documents have been deleted.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:afterDelete': async (documents, request) => {
        // The "documents" argument contains the documents that have been
        // deleted.
        //
        // Example: logs the number of documents deleted in the foo:bar
        // collection
        const { index, collection } = request.input.args;

        if (index === 'foo' && collection === 'bar') {
          context.log.info(`${documents.length} documents deleted in foo:bar`);
        }

        return documents;
      }
    };
  }

}
```

### Triggered by

- [document:delete](/core/2/api/controllers/document/delete)
- [document:mDelete](/core/2/api/controllers/document/m-delete)
- [document:deleteByQuery](/core/2/api/controllers/document/delete-by-query)

---

## generic:document:afterGet

| Arguments   | Type                                                                                     | Description                                                   |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing documents `_id` and `_source`) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                                    |

Triggered after documents are fetched.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:afterGet': async (documents, request) => {
        // The "documents" argument contains the documents that have been
        // fetched.
        //
        // Example: removes sensitive information from documents of the
        //          foo:bar collectin
        const { index, collection } = request.input.args;

        if (index === 'foo' && collection === 'bar') {
          documents.forEach(d => delete d._source.foo);
        }

        return documents;
      }
    };
  }

}
```

### Triggered by

- [document:get](/core/2/api/controllers/document/get)
- [document:mGet](/core/2/api/controllers/document/m-get)
- [document:search](/core/2/api/controllers/document/search)

---

## generic:document:afterUpdate

| Arguments   | Type                                                                                     | Description                                                           |
| ----------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing a document `_id` and `_source` fields) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                                            |

Triggered after partial updates are applied to documents.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:afterUpdate': async (documents, request) => {
        // The "documents" argument contains the documents that have been
        // updated, and it can be changed by this pipe function.
        //
        // Example: logs the number of documents updated in the foo:bar
        // collection
        const { index, collection } = request.input.args;

        if (index === 'foo' && collection === 'bar') {
          context.log.info(`${documents.length} documents updated in foo:bar`);
        }

        return documents;
      }
    };
  }

}
```

### Triggered by

- [document:update](/core/2/api/controllers/document/update)
- [document:upsert](/core/2/api/controllers/document/upsert)
- [document:mUpdate](/core/2/api/controllers/document/m-update)
- [document:updateByQuery](/core/2/api/controllers/document/update-by-query)

---

## generic:document:afterWrite

| Arguments   | Type                                                                                     | Description                                                           |
| ----------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing a document `_id` and `_source` fields) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                                            |

Triggered after documents have been created or replaced.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:afterWrite': async (documents, request) => {
        // The "documents" argument contains the documents that have been
        // created/replaced, and it can be updated by this pipe function.
        //
        // Example: logs the number of documents created in the foo:bar
        // collection
        const { index, collection } = request.input.args;

        if (index === 'foo' && collection === 'bar') {
          context.log.info(`${documents.length} documents written in foo:bar`);
        }

        return documents;
      }
    };
  }

}
```

### Triggered by

- [document:create](/core/2/api/controllers/document/create)
- [document:createOrReplace](/core/2/api/controllers/document/create-or-replace)
- [document:mCreate](/core/2/api/controllers/document/m-create)
- [document:mCreateOrReplace](/core/2/api/controllers/document/m-create-or-replace)
- [document:mReplace](/core/2/api/controllers/document/m-replace)
- [document:replace](/core/2/api/controllers/document/replace)

---

## generic:document:beforeDelete

| Arguments   | Type                                                                                     | Description                                    |
| ----------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing document `_id`) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                     |

Triggered before documents are deleted.

### Example

```javascript
class PipePlugin {
  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeDelete': async (documents, request) => {
        // The "documents" argument contains the documents about to be
        // deleted.
        //
        // Example: forbids deletions of documents containing a "foo:bar" field
        const { index, collection } = request.input.args;

        const response = await context.accessors.sdk.document.mGet(
          index,
          collection,
          documents.map(d => d._id));

        for (const document of response.successes) {
          if (document._source.foo === 'bar') {
            throw context.errors.ForbiddenError('foobar documents cannot be deleted');
          }
        }

        return documents;
      }
    };
  }

}
```

### Triggered by

- [document:delete](/core/2/api/controllers/document/delete)
- [document:mDelete](/core/2/api/controllers/document/m-delete)

---

## generic:document:beforeGet

| Arguments   | Type                                                                                     | Description                                    |
| ----------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing document `_id`) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                     |

Triggered before documents are fetched.

### Example

```javascript
class PipePlugin {
  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeGet': async (documents, request) => {
        // The "documents" argument contains the documents about to be
        // fetched.
        //
        // Example: refuses to fetch documents with ids starting with "foobar_"
        //          in collection foo:bar
        const { index, collection } = request.input.args;

        if (index === 'foo' && collection === 'bar') {
          for (const document of documents) {
            if (document._id.startsWith('foobar_')) {
              throw context.errors.ForbiddenError('Cannot fetch foobar documents');
            }
          }
        }

        return documents;
      }
    };
  }

}
```

### Triggered by

- [document:get](/core/2/api/controllers/document/get)
- [document:mGet](/core/2/api/controllers/document/m-get)

---

## generic:document:beforeUpdate

| Arguments   | Type                                                                                     | Description                                                           |
| ----------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing a document `_id` and `_source` fields) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                                            |

Triggered before partial updates are applied to documents.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeUpdate': async (documents, request) => {
        // The "documents" argument contains the documents about to be
        // updated, and it can be changed by this pipe function.
        //
        // Example: adds a "foo: 'bar'" key/value to all documents' content
        // if added to the foo:bar collection
        const { index, collection } = request.input.args;

        if (index === 'foo' && collection === 'bar') {
          documents.forEach(d => (d._source.foo = 'bar'));
        }

        return documents;
      }
    };
  }

}
```

### Triggered by

- [document:update](/core/2/api/controllers/document/update)
- [document:upsert](/core/2/api/controllers/document/upsert)
- [document:mUpdate](/core/2/api/controllers/document/m-update)

---

## generic:document:beforeWrite

| Arguments   | Type                                                                                     | Description                                                             |
| ----------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `documents` | <pre>Array</pre>                                                                         | Array of documents (containing a document's `_id` and `_source` fields) |
| `request`   | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                                              |


Triggered before documents are created or replaced.

### Example

```javascript
class PipePlugin {
  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeWrite': async (documents, request) => {
        // The "documents" argument contains the documents about to be
        // created/replaced, and it can be updated by this pipe function.
        //
        // Example: adds a "foo: 'bar'" key/value to all documents' content
        // if added to the foo:bar collection
        const { index, collection } = request.input.args;

        if (index === 'foo' && collection === 'bar') {
          documents.forEach(d => (d._source.foo = 'bar'));
        }

        return documents;
      }
    };
  }
}
```

### Triggered by

- [document:create](/core/2/api/controllers/document/create)
- [document:createOrReplace](/core/2/api/controllers/document/create-or-replace)
- [document:mCreate](/core/2/api/controllers/document/m-create)
- [document:mCreateOrReplace](/core/2/api/controllers/document/m-create-or-replace)
- [document:mReplace](/core/2/api/controllers/document/m-replace)
- [document:replace](/core/2/api/controllers/document/replace)

## generic:document:injectMetadata

This event is called with an object containing the following properties:

| Fields            | Type                                                                                     | Description                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `request`         | <pre><a href=/core/2/framework/classes/kuzzle-request/properties>KuzzleRequest</a></pre> | The underlying API request                                                                                                         |
| `metadata`        | <pre>JSONObject</pre>                                                                    | An object representing the metadata that will be injected in the document                                                          |
| `defaultMetadata` | <pre>JSONObject</pre>                                                                    | An object representing the default metadata that will be injected in the document when created. (only used with `document:upsert`) |


Triggered before documents are created, replaced, updated or upserted.

### Example

```typescript
app.pipe.register<EventGenericDocumentInjectMetadata>("generic:document:injectMetadata", async (event) => {
  // The "event" argument contains:
  // - The request that triggered the pipe
  // - The metadata to inject in the document, this field contains by the default the metadata with correct values that Kuzzle wants to inject in the document:
  //    - author
  //    - createdAt
  //    - updater
  //    - updatedAt
  // - The defaultMetadata to inject (only for document:upsert)
  //
  // You can change / add new field to the metadata that are going to be injected
  // in the document.
  return {
    request: event.request,
    metadata: {
      ...event.metadata,
      customMetadata: 'foo'
    }
  };
});
```

### Triggered by

- [document:create](/core/2/api/controllers/document/create)
- [document:createOrReplace](/core/2/api/controllers/document/create-or-replace)
- [document:replace](/core/2/api/controllers/document/replace)
- [document:update](/core/2/api/controllers/document/update)
- [document:upsert](/core/2/api/controllers/document/upsert)