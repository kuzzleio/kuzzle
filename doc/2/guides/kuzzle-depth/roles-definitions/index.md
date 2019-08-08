---
code: false
type: page
title: Dynamic Roles Definitions
---

# Dynamic Roles Definitions

In the [Getting Started Guide](/core/1/guides/essentials/security/#user-permissions), we discussed how to assign basic permissions to users through roles and profiles. We are now going to look at more complex and dynamic permissions.

By definition, permissions only control to what API actions users can access depending on their profiles, without conditions.

But there are times when more dynamic rules are needed, for instance when an API action can only be executed if the payload matches some arbitrary business rules.

This can be address either with a [**Pipe Plugin**](/core/1/plugins/guides/pipes), or **Permission Closures**.

---

## Permission Closures

<DeprecatedBadge version="1.4.0" />

Permission closures are deprecated in favor of [Pipe Plugin](/core/1/plugins/guides/pipes), which are more flexible and simpler to use.

With Permission Closures, instead of hard-coding the permission boolean value, we assign a function (or closure) that evaluates to a boolean value and determines whether or not an action is permitted.

For example, here is a role definition that limits access to documents such that a document can only be modified by its owner:

```js
{
  "controllers": {
    "document": {
      "actions": {
        "update": {
          "args": {
            "document": {
              "index": "$request.input.resource.index",
              "collection": "$request.input.resource.collection",
              "action": {
                "get": "$currentId"
              }
            }
          },
          "test": "return args.document.content.user.id === $currentUserId"
        }
      }
    }
  }
}
```

In the definition above:

- `test` is the body of [the permission function](/core/1/guides/kuzzle-depth/roles-definitions/#the-permission-function)
- `args` is the parameter given to [the fetch definition function](/core/1/guides/kuzzle-depth/roles-definitions/#the-fetch-definition)

---

### The Permission Function

The permission function is executed in a sandbox with a limited context. It is defined in the `test` parameter of the role definition and **must return a boolean value**.

The permission function has the following signature:

```js
/**
 * @param {Request} $request              The current action request.
 * @param {string} $currentUserId         The current user kuid. Shortcut to request.context.token.userId
 * @param {Object} args                   The result of the evaluated args definition.
 *
 * @return {Boolean}
 */
function ($request, $currentUserId, args) {
  // the function body is built from the "test" parameter.
  // Example, with the sample role above:
  return args.document.content.user.id === $currentUserId;
};
```

#### Permission Function Predefined Variables

There are a set of predefined variables which are automatically accessible in a Permission Function, these are:

- `$request`: The complete [request](https://github.com/kuzzleio/kuzzle-common-objects#request) object being evaluated.
- `$currentUserId`: The current user [`<kuid>`](/core/1/guides/essentials/user-authentication/#kuzzle-user-identifier-kuid) (equivalent to `request.context.token.userId`).

#### Permission Function Args

The main purpose of the "closure" behavior is to grant permissions based on the current state of the storage layer. This means that, in order to determine if an action can be granted, we will first need to fetch documents used in the permission function from the storage layer.

Documents fetched from the storage layer are stored in the `args` object as defined by the [fetch definition](/core/1/guides/kuzzle-depth/roles-definitions/#the-fetch-definition).

Each `args` object will look like:

```js
{
  "content": {}, // the document itself
  "id": "<document id>"
}
```

In the sample role above (`return args.document.content.user.id === $currentUserId`), the `update` action is allowed only if the fetched document contains an attribute `user.id` with value equal to the current user's id.

---

### The Fetch Definition

The Fetch Definition allows you to pass documents fetched from the persistence layer to your Permission Function.

In our sample role above, the `document` variable references the document we want to update and it is used in the Permission Function to test if the current user is the document owner.

#### Fetch Definition Predefined Variables

There are a set of predefined variables which are automatically accessible in a Fetch Definition, these are:

- `$request`: The complete request object being evaluated.
- `$currentId`: The current request document id (equivalent to `$request.input.resource._id`).

#### Fetch Definition Args

We define the Fetch Definition in a `args` object with the following structure:

```js
{
  "args": {
    "<some variable>": {
      "index": "<index from which to fetch the document(s)>",
      "collection": "<collection from which to fetch the document(s)>",
      "action": {
        "<action type (get|mget|search)>": {} // <action type specific parameters>
      }
    },
    "<another variable>": {
      // ...
    },
    // ...
  }
}
```

You can define one or more variables inside the `args` object and, for each variable, define the action used to populate it. Each of these variables will then be available in the [permission function](/core/1/guides/kuzzle-depth/roles-definitions/#the-permission-function), accessible in the `args` object as follows: `args.<variable>`.

#### Fetch Definition Actions

##### GET

The `get` action type fetches a document by its id. For example:

```js
{
  "args": {
    "currentDocument": {
      "index": "$request.input.resource.index",
      "collection": "$request.input.resource.collection",
      "action": {
        "get": "$currentId"
      }
    },
    "anotherDocument": {
      "index": "myIndex",
      "collection": "myCollection",
      "action": {
        "get": "document_id"
      }
    }
  }
}
```

In the `args` object above, we declare the following Fetch Definition:

- `currentDocument` which represents the document that the user wants to update and whose Fetch Definition is composed of:
  - `index`: the index where the collection resides
  - `collection`: the collection in the index
  - `$currentId`: the document id as defined in the `get` request
- `anotherDocument` which represents another document, just as an example, fetched the same way as the previous one but with different parameters.

##### MGET

The `mget` action type accepts a list of document ids and returns the list of matching documents.

```js
{
  "args": {
    "myDocuments": {
      "index": "myIndex",
      "collection": "myCollection",
      "action": {
        "mget": [
          "id_1",
          "id_2",
          // ...
        ]
      }
    }
  }
}
```

In the `args` object, we declare a multi-valued Fetch Definition. Notice how the `mget` action takes an array of ids rather than a single value.

These documents are then accessed in the Permission Function as follows:

```js
args.myDocuments = [
  {
    id: "id_1", content: {name: "Document 1", description: "Cum sociis natoque penatibus et magnis dis parturient montes"},
  }
  {
    id: "id_2", content: {name: "Document 2", description: "nascetur ridiculus mus. Nulla nunc velit"},
  }
  ...
]
```

##### SEARCH

The `search` action type performs a search on the persistence layer and returns the resulting documents. It is a typical [document search](/core/1/guides/essentials/store-access-data/#document-search). For example:

```js
{
  "args": {
    "myDocuments": {
      "index": "myIndex",
      "collection": "myCollection",
      "action": {
        "search": {
          "filter": {
            "match": {
              "name": "$request.input.body.name"
            }
          }
        }
      }
    }
  }
}
```

The search results are available in the Permission Function as an array of documents fetched from `myIndex`/`myCollection`, for which the `name` attribute matches the `name` attribute of the request:

```js
args.myDocuments = [
  { id: "id_1", content: {name: "foo", description: "Cum sociis natoque penatibus et magnis dis parturient montes"}},
  { id: "id_2", content: {name: "foo bar", description: "nascetur ridiculus mus. Nulla nunc velit"}},
  ...
]
```

The content of `action.search` is passed directly to Elasticsearch.

Please refer to our [Elasticsearch Cookbook](/core/1/guides/cookbooks/elasticsearch/) for more help on how to build your search query.
