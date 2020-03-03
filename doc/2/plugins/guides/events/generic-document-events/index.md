---
type: page
code: false
title: Generic Events
order: 150
---

# Generic Document Events

<SinceBadge version="1.9.0" />

Some actions in the document controller trigger generic events. Generic events are used to apply modifications on the documents in the request or result of these actions.

Generic "before" events (`generic:document:before*`) are triggered **before** the regular `document:before*` event.  
Generic "after" events (`generic:document:after*`) are triggered **after** the regular `document:after*` event.

All the pipes triggered by generic events have the same signature and should resolves the array of the updated documents from parameters.

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:<event>': async (documents, request) => {
        // some random change on documents

        return documents;
      }
    };
  }

}
```

---

## generic:document:beforeWrite

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing a document's `_id` and `_source` fields) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:beforeWrite` generic events allow to intercept the Request lifecycle before all the actions related to document writing.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeWrite': async (documents, request) => {
        // some random change
        documents[0]._source.foo = 'bar';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:create](/core/2/api/controllers/document/create)
- [document:createOrReplace](/core/2/api/controllers/document/create-or-replace)
- [document:mCreate](/core/2/api/controllers/document/m-create)
- [document:mCreateOrReplace](/core/2/api/controllers/document/m-create-or-replace)
- [document:mReplace](/core/2/api/controllers/document/m-replace)
- [document:replace](/core/2/api/controllers/document/replace)

## generic:document:afterWrite

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing a document `_id` and `_source` fields) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:afterWrite` generic events allow to intercept the request lifecycle after all the actions related to document writing.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:afterWrite': async (documents, request) => {
        // some random change
        documents[0]._source.foo = 'bar';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:create](/core/2/api/controllers/document/create)
- [document:createOrReplace](/core/2/api/controllers/document/create-or-replace)
- [document:mCreate](/core/2/api/controllers/document/m-create)
- [document:mCreateOrReplace](/core/2/api/controllers/document/m-create-or-replace)
- [document:mReplace](/core/2/api/controllers/document/m-replace)
- [document:replace](/core/2/api/controllers/document/replace)


## generic:document:beforeUpdate

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing a document `_id` and `_source` fields) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:beforeUpdate` generic events allow to intercept the Request lifecycle before all the actions related to document updating.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeUpdate': async (documents, request) => {
        // some random change
        documents[0]._source.foo = 'bar';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:update](/core/2/api/controllers/document/update)
- [document:mUpdate](/core/2/api/controllers/document/m-update)


## generic:document:afterUpdate

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing a document `_id` and `_source` fields) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:afterUpdate` generic events allos to intercept the Request lifecycle after all the actions related to document updating.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:afterUpdate': async (documents, request) => {
        // some random change
        documents[0]._source.foo = 'bar';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:update](/core/2/api/controllers/document/update)
- [document:mUpdate](/core/2/api/controllers/document/m-update)


## generic:document:beforeDelete

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing document `_id`) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:beforeDelete` generic events allow to intercept the Request lifecycle before all the actions related to document deleting.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeDelete': async (documents, request) => {
        // some random change
        documents[0]._id += 'foo';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:delete](/core/2/api/controllers/document/delete)
- [document:mDelete](/core/2/api/controllers/document/m-delete)


## generic:document:afterDelete

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing document `_id`) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:afterDelete` generic events allow to intercept the Request lifecycle after all the actions related to document deleting.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:afterDelete': async (documents, request) => {
        // some random change
        documents[0]._id += 'foo';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:delete](/core/2/api/controllers/document/delete)
- [document:mDelete](/core/2/api/controllers/document/m-delete)
- [document:deleteByQuery](/core/2/api/controllers/document/delete-by-query)


## generic:document:beforeGet

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing document `_id`) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:beforeGet` generic events allow to intercept the Request liecycle before all the actions related to document getting.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeGet': async (documents, request) => {
        // some random change
        documents[0]._id += 'foo';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:get](/core/2/api/controllers/document/get)
- [document:mGet](/core/2/api/controllers/document/m-get)


## generic:document:afterGet

| Arguments | Type                                                           | Description                |
| --------- | -------------------------------------------------------------- | -------------------------- |
| documents | `Array` | Array of documents (containing document `_id`) |
| request | `Request` | [Kuzzle API Request](/core/2/plugins/plugin-context/constructors/request#request) |

`generic:document:afterGet` generic events allow to intercept the Request lifecycle after all the actions related to document getting.

### Example

```javascript
class PipePlugin {

  init(customConfig, context) {
    this.pipes = {
      'generic:document:beforeGet': async (documents, request) => {
        // some random change
        documents[0]._id += 'foo';

        return documents;
      }
    };
  }

}
```

### Associated controller actions:
- [document:get](/core/2/api/controllers/document/get)
- [document:mGet](/core/2/api/controllers/document/m-get)
- [document:search](/core/2/api/controllers/document/search)
