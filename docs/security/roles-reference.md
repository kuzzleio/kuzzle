# Roles definition reference

## Table of content

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Overview](#overview)
- [&#95;canDelete and &#95;canCreate](#&95candelete-and-&95cancreate)
- [Composition rules](#composition-rules)
- [Actions permissions functions](#actions-permissions-functions)
  - [The permission function](#the-permission-function)
    - [Parameters](#parameters)
      - [$requestObject](#requestobject)
      - [context](#context)
      - [$currentUserId](#currentuserid)
      - [args](#args)
  - [The fetch definition](#the-fetch-definition)
    - [args element structure](#args-element-structure)
      - [_get_ action type](#_get_-action-type)
      - [_mget_ action type](#_mget_-action-type)
      - [_search_ action type](#_search_-action-type)
      - [available variables](#available-variables)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Overview

The `role` definition is represented as a hierarchical object for one or more `indexes`.

```js
var myRoleDefinition = {
  indexes: {
    _canCreate: true|false,
    < index|* >: {
      _canDelete: true|false,
      collections: {
        _canCreate: true|false,
        < collection|* >: {
          _canDelete: true|false,
          controllers: {
            < controller|* >: {
              actions: {
                < action|* >: < action permission* >,
                < action|* >: < action permission* >,
                ...
              }
            }
          }
        }
      }
    }
  }
};
```

Each entry of the `indexes`, `collections`, `controllers`, `actions` tree can be set to either an explicit value or the "&#42;" wildcard.

The `action permission` value can be set either to:
* a boolean. When set to `true`, the user is allowed to perform the action.
* an object that describes a function (more about it in the [action permissions functions section](#actions-permissions-functions)).

example:

```js
var anonymousRole = {
  indexes: {
    _canCreate: false,
    "*": {
      _canDelete: false,
      collections: {
        _canCreate: false,
        "*": {
          _canDelete: false,
          controllers: {
            auth: {
              actions: {
                login: true,
                checkToken: true,
                getCurrentUser: true
              }
            }
          }
        }
      }
    }
  }
};
```

The example above is the permission definition set by Kuzzle for the Anonymous user after the first admin user has been created.

In this example, the role denies every action to the user, except the `login`, `checkToken` and `getCurrentUser` actions of the `auth` controller.

## &#95;canDelete and &#95;canCreate

Some permissions are not related to an index or a collection like for instance creating or deleting an index or a collection.

To handle such cases, the role definition accepts the `_canDelete` and `_canCreate` parameters.

* `_canCreate` needs to be defined _at the level above_ of the target.
* `_canDelete` needs to be defined at the first sub-level of the target.

Example:

```js
var role = {
  indexes: {
    _canCreate: true,
    myIndex: {
      _canDelete: false,
      ...
    }
  }
};
```
The above example allows the user to create any index and forbids to delete the _myIndex_ index.

## Composition rules

The composition rule is:

> The more specific overrides the less specific.

Example:

```js
var role = {
  indexes: {
    myIndex: {
      collections: {
        "*": {
          controllers: {
            "*": {
              actions: {
                "*": true
              }
            }
          }
        },
        forbiddenCollection: {
          controllers: {
            "*": {
              actions: {
                "*": false
              }
            }
          }
        }
      }
    }
  }
};
```

In the example above, the user is granted any action on any collection of _myIndex_ **except** for the _forbiddenCollection_, for which he is denied any action.

## Actions permissions functions

So far, we've seen how to set permissions based on the users profiles only.

Now, let's say we have a chat application and want the users to be allowed to edit & delete their own messages only.

This type of rules depends on the context and cannot be expressed as a simple boolean.

Kuzzle lets you define some more complex permissions using a custom function, which can dynamically decide wether the user is allowed to proceed or not depending on the context.

In our chat example, the rule can be expressed as:

```js
var role = {
  indexes: {
    myIndex: {
      collections: {
        chatMessages: {
          controllers: {
            write: {
              actions: {
                create: true,
                delete: {
                  args: {
                    document: {
                      collection: "myIndex",
                      index: "chatMessages",
                      action: {
                        get: "$currentId"
                      }
                    }
                  },
                  test: "return args.document.content.user.id === $currentUserId"
                }
              }
            }
          }
        }
      }
    }
  }
};
```

### The permission function

The permission function has the following signature:

```js
/**
 * @param {RequestObject} $requestObject  The current action request.
 * @param {Object} context                The current connection context. Contains the connection type and the current user.
 * @param {string} $currentUserId         The current user Id. Shortcut to context.token.user._id
 * @param {Object} args                   The result of the evaluated args definition.
 *
 * @return {Boolean}
 */
function ($requestObject, context, $currentUserId, args) {
  // the function body is built from the "test" parameter
};
```

The permission function is executed in a sandbox with a limited scope. Its body is the evaluation of the _test_ parameter given in the definition.

#### Parameters

##### $requestObject

The request object is the request that is currently being evaluated.  
A typical request object will look like:

```js
var requestObject = {
  index: "myIndex",
  collection: "myCollection",
  controller: "write",
  action: "update",
  data: {
    _id: "id_1",
    body: {
      foo: "bar"
    }
  },
  headers: {
    someHeader: "some header value",
  },
  metadata: {
    someMetadata: "some metadata value"
  },
  requestId: "66978665-1ac5-4770-890c-59cc88f89098",
  timestamp: 14582100322345
};
```

##### context

The context object stores some information about the current connection.  
A typical context object will look like:

```js
var context = {
  connection: {
    id: "/#O3u2-yCDXsYyqLr5AAAA",
    type: "socketio"
  },
  token: {
    _id: undefined,
    expiresAt: null,
    ttl: null,
    user: {
      _id: "login",
      name: "Username",
      profile: {
        // user profile object.
      }
    }
  }
};
```

##### $currentUserId

The _$currentUserId_ variable contains the current user id. It is an alias for `context.token.user._id`.

##### args

The _args_ object contains the result of the evaluation of the fetch definition (cf below).


### The fetch definition

The optional _args_ parameter given to the permission function is the result of the evaluation of some fetch definition given in the args section of the role definition.

Using this ability, you can pass some documents fetches from Kuzzle's database layer to your permission function.

In our chat example above, we fetch a _document_ variable which contains the the document that was requested for deletion and that we use in the permission function to test if it is owned by the current user.

#### args element structure

The _args_ element has the following structure:

```js
var args = {
    <some variable>: {
      index: <index from which to fetch the document(s)>,
      collection: <collection in which the document(s)  are fetched>,
      action: {
        <action type (get|mget|search)>: <action type specific parameters>
      }
    },
    <another variable>: {
      ...
    },
    ...
};
```

You can define one or more _variables_ inside the args element and, for each of them, the action to use to populate them.

The _variable_ will then be availalbe from your permission function under args._<variable>_.

##### _get_ action type

The `get` action type performs a read/get call. It takes a document id for entry and returns the matching document.

```js
var args = {
    myDocument: {
      index: "myIndex",
      collection: "myCollection",
      action: {
        get: "$currentId"
      }
    }
};
```

##### _mget_ action type

The `mget` action type takes a list of document ids for entry and returns the list of matching documents.

```js
var args = {
  myDocuments: {
    index: "myIndex",
    collection: "myCollection",
    action: {
      mget: [
        "id_1",
        "id_2",
        ...
      ]
    }
  }
};
```

##### _search_ action type

The `search` action type makes a search in Kuzzle's database layer and returns the related documents.

```js
var args = {
  myDocuments: {
    collection: "myCollection",
    action: {
      search: {
        filter: {
          match: {
            name: "$requestObject.data.body.name"
          }
        }
      }
    }
  }
};
```

The action.search value is sent to Kuzzle's database layer directly, being Elasticsearch 1.7.

Please refer to [Elasticsearch search API documentation](https://www.elastic.co/guide/en/elasticsearch/reference/1.7/search-request-body.html) for additional information on how to build your query.

##### available variables

Some variables are exposed by Kuzzle and can be used within your fetch function definition:

* `$currentId`: The current request document id. Shortcut to $requestObject.data.&#95;id.
* `$requestObject`: The complete request object being evaluated.
