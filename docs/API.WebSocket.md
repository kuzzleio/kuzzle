# Kuzzle WebSocket API Specifications

## Introduction

You can connect your application directly to Kuzzle, using WebSockets.

This will give you a direct access to Kuzzle's router controller, dispatching your queries to the right components, which in turn will send you back a ``response``


## Index

* [How to connect to Kuzzle](#how-to-connect-to-kuzzle)
* [What are response objects](#what-are-response-objects)
* [Sending metadata](#sending-metadata)
* [Performing queries](#performing-queries)
  * [Subscribing to documents](#subscribing-to-documents)
    * [Notifications you can receive](#notifications)
  * [Counting the number of subscriptions on a given room](#counting-the-number-of-subscriptions-on-a-given-room)
  * [Unsubscribing to a room](#unsubscribing-to-a-room)
  * [Sending a non persistent message](#sending-a-non-persistent-message)
  * [Creating a new document](#creating-a-new-document)
  * [Creating or Updating a document](#creating-or-updating-a-document)
  * [Retrieving a document](#retrieving-a-document)
  * [Searching for documents](#searching-for-documents)
  * [Updating a document](#updating-a-document)
  * [Counting documents](#counting-documents)
  * [Deleting a document using a document unique ID](#deleting-a-document-using-a-document-unique-id)
  * [Deleting documents using a query](#deleting-documents-using-a-query)
  * [Deleting an entire data collection](#deleting-an-entire-data-collection)
  * [Setting up a data mapping on a collection](#setting-up-a-data-mapping-in-a-collection)
  * [Retrieving the data mapping of a collection](#retrieving-the-data-mapping-of-a-collection)
  * [Performing a bulk import](#performing-a-bulk-import-on-a-data-collection)
  * [Performing a global bulk import](#performing-a-global-bulk-import)
  * [Getting the last statistics frame](#getting-the-last-statistics-frame)
  * [Getting the statistics from a date](#getting-the-statistics-from-a-date)
  * [Getting all stored statistics](#getting-all-stored-statistics)
  * [Listing all known data collections](#listing-all-known-data-collections)
  * [Getting the current Kuzzle timestamp](#getting-the-current-kuzzle-timestamp)

##  How to connect to Kuzzle

To establish communication with Kuzzle using WebSockets, simply connect your application to Kuzzle's WebSocket port.
By default, the router controller listens to the port 7512 for WebSocket applications.

##  What are ``response`` objects

A ``response`` is the result of a query you send to Kuzzle. It may be the results of a search query, an acknowledgement of a created action, and so on.  
And when you subscribe to a room, Kuzzle also sends notifications to your application in the form of a ``response`` object.

A ``response`` is a JSON object with the following structure:

```javascript
{
  /*
  Integer containing the status code (HTTP-like: 200 if OK, 4xx or 5xx in case of error)
  */
  status: xxx,

  /*
  Complex object containing error information, if something went wrong (null if OK)
  */
  error: {...},

  /*
  Complex object, depending on your query
  */
  result: {
    requestId: <unique ID>  // Your query unique identifier. See below.
    ...
  }
}
```

_NB: For more details about status code and error object, see [status-codes.md](status-codes.md)_

Kuzzle will respond to your application by sending a ``requestId`` message on your socket, so you should specify one to get a response. And for some queries, this argument is required, as it wouldn't have any sense for Kuzzle to not be able to send you a response (for instance, when performing a document search).

So to get a response from Kuzzle, simply add a unique ``requestId`` field to your message (for instance by using an [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier)), and then listen for a ``requestId`` message on your socket.

## Sending metadata

In every request you send to Kuzzle, you can include a ``metadata`` object. This object content will be ignored by Kuzzle, but it will also be forwarded back in ``responses`` and in ``notifications`` (see below).

You can also include metadata information to a subscription request. These metadata information will be forwarded to other subscribers at the moment of the subscription, and when you leave the room. Please note that when leaving the room, the forwarded metadata are those provided in the **subscription** request.

This feature is especially useful to include volatile information about the performed request.

For example, if you update a document:

```javascript
{
  action: 'update',
  collection: 'some data collection',
  _id: 'a document ID',
  body: {
    somefield: 'now has a new value'
  },
  metadata: {
    modifiedBy: 'awesome me',
    reason: 'it needed to be modified'
  }
}
```

The following ``update`` notification will be sent to all subscribed users:

```javascript
{
  status: 200,
  error: null,
  result: {
    _id: 'a document ID',
    _source: {
      somefield: 'now has a new value',
      someOtherField: 'was left unchanged'
    },
    action: 'update',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>',
    metadata: {
      modifiedBy: 'awesome me',
      reason: 'it needed to be modified'
    }
  }
}
```

Or if you subscribe:

```javascript
{
  action: 'on',
  collection: 'some data collection',
  body: {
    // subscription filters
  },
  metadata: {
    hello: 'my name is Bob'
  }
}
```

And then if you leave this room, other subscribers will receive this notification:

```javascript
{
  status: 200,
  error: null,
  result: {
    roomId: 'unique Kuzzle room ID',
    controller: 'subscribe',
    action: 'off',
    count: <the new user count on that room>,
    metadata: {
      hello: 'my name is Bob'
    }
  }
}
```

##  Performing queries

This section details every query you can send to Kuzzle, and the ``response`` object Kuzzle will send you back, if any.

Each query you make needs to specify:

* what ``action`` you want to perform,
* and the ``data collection`` you want to query

Moreover, you need to emit to Kuzzle a ``controller`` message, where ``controller`` is the Kuzzle component that will execute your query.

This documentation will tell you the corresponding ``controller`` and ``action``. The only thing you need to know is what a ``data collection`` is.  
Simply put, a ``data collection`` is a set of data managed internally by Kuzzle. It acts like a data table for persistent documents, or like a room for pub/sub messages.  


---

###  Subscribing to documents

Subscription works differently in Kuzzle than with a regular publish/subscribe protocol.  
In Kuzzle, you don't exactly subscribe to a room or a topic but, instead, you subscribe to documents.

What it means is that, along with your subscription query, you also give to Kuzzle a set of matching criteria.  
Once you have subscribed to a room, if a pub/sub message is published matching your criteria, or if a matching stored document changes (because it is created, updated or deleted), then you'll receive a notification about it.  
Notifications are ``response`` objects.

Of course, you may also subscribe to a ``data collection`` with no other matching criteria, and you'll effectively listen to a 'topic'.

The matching criteria you pass on to Kuzzle are [filters](./filters.md).

How subscription works:  
:arrow_right: You send a subscription query to Kuzzle  
:arrow_left: Kuzzle responds to you with a room unique ID  
:arrow_right: You listen to ``requestId`` messages on your websocket
:arrow_left: When a document matches your room criteria, Kuzzle sends you a ``response``

**Message type:** ``subscribe``

**Query:**

```javascript
{
  action: 'on',
  collection: '<data collection>',

  /*
  Required. If your query doesn't include a requestId field, Kuzzle
  will discard your query, because it doesn't have any means to send you
  the resulting room ID.
  */
  requestId: <room name>,

  /*
  A set of filters matching documents you want to listen to
  */
  body: {

  }
}
```

**Note:** If an empty body is provided, the subscription is performed on the whole collection

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    requestId: <Unique ID>,
    controller: 'subscribe',
    action: 'on',
    metadata: {}                   // subscription metadata
  }
}
```

####  Notifications

Once you receive this ``response``, all you have to do is to listen to ``requestId`` messages on your websocket to receive notifications.

There are 4 types of notifications you can receive:

#### 'A document has been created' notification:

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    _source: {                        // The created document

    },
    action: 'create',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>',  // The query updating the document document
    metadata: {
      // metadata embedded in the modifying request
    }
  }
}
```

#### 'An updated document entered your listening scope' notification:

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    _source: {                        // The updated document

    },
    action: 'update',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>',  // The query updating the document
    metadata: {
      // metadata embedded in the modifying request
    }
  }
}
```

#### 'An updated document left your listening scope' notification:

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    action: 'update',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>',  // The query updating the document
    metadata: {
      // metadata embedded in the modifying request
    }
    // there is no document source in this notification
  }
}
```


#### 'A document has been deleted' notification:

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    action: 'delete',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>',  // The query deleting the document
    metadata: {
      // metadata embedded in the modifying request
    }
    // there is no document source in this notification
  }
}
```

#### 'A user entered a room' notification:

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    controller: 'subscribe',
    action: 'on',
    count: <the new user count on that room>,
    metadata: {
      // metadata embedded in this user's subscription request
    }
  }
}
```
#### 'A user left a room' notification:

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    controller: 'subscribe',
    action: 'off',
    count: <the new user count on that room>,
    metadata: {
      // metadata embedded in this user's subscription request
    }
  }
}
```

---

###  Counting the number of subscriptions on a given room

Return the number of people/applications who have subscribed to the same documents as you.

It works with the room unique ID Kuzzle returns to you when you make a subscription.

**Message type:** ``subscribe``

**Query:**

```javascript
{
  action: 'count',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>,

  body: {
    roomId: 'unique Kuzzle room ID'
  }
}
```

**Response:**

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    count: <number of subscriptions>,
    requestId: <Unique ID>,
    controller: 'subscribe',
    action: 'count'
  }
}
```

---

###  Unsubscribing to a room

Makes Kuzzle remove you from its subscribers on this room.

**Message type:** ``subscribe``

**Query:**

```javascript
{
  action: 'off',
  collection: '<data collection>',

  body: {
    roomId: 'unique Kuzzle room ID'
  }
}
```

**Response:**

```javascript
{
  status: 200,                       // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    requestId: <Unique ID>,
    controller: 'subscribe',
    action: 'off',
    metadata: {}                   // subscription metadata
  }
}
```

---

###  Sending a non persistent message

**Message type:** ``write``

**Query:**

```javascript
{
  action: 'create',
  collection: '<data collection>',

  // Tells Kuzzle to send a non persistent message
  persist: false,

  /*
  The document itself
  */
  body: {
    ...
  }
}
```

**Response:** Kuzzle doesn't send a response when sending non persistent message.

---

###  Creating a new document

Creates a new document in the persistent data storage. Returns an error if the document already exists.

**Message type:** ``write``

**Query:**

```javascript
{
  action: 'create',
  collection: '<data collection>',

  // Tells Kuzzle to store your document
  persist: true,

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  The document itself
  */
  body: {
    ...
  }
}
```

**Kuzzle response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _id: '<Unique document ID>',    // The generated document ID
    _source: {                      // The created document
      ...
    },
    collection: '<data collection>',
    action: 'create',
    controller: 'write',
    requestId: '<unique request identifier>',
    _version: 1                     // The version of the document in the persistent data storage
  }
}
```

---

###  Creating or Updating a document

Creates a new document in the persistent data storage, or update it if it already exists.

**Message type:** ``write``

**Query:**

```javascript
{
  action: 'createOrUpdate',
  collection: '<data collection>',

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  The document itself
  */
  body: {
    ...
  }
}
```

**Kuzzle response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _id: '<Unique document ID>',    // The generated document ID
    _source: {                      // The created document
      ...
    },
    collection: '<data collection>',
    action: 'createOrUpdate',
    controller: 'write',
    requestId: '<unique request identifier>',
    _version: <number>,             // The new version number of this document
    created: <boolean>              // true: a new document has been created, false: the document has been updated
  }
}
```

---

###  Retrieving a document

Only documents in the persistent data storage layer can be retrieved.

**Message type:** ``read``

**Query:**

```javascript
{
  action: 'get',
  collection: '<data collection>',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>,

  /*
  The document unique identifier. It's the same one that Kuzzle sends you
  in its responses when you create a document, or when you do a search query.
  */
  _id: '<document ID>'
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _id: '<Unique document ID>',    // The generated document ID
    _source: {                      // The requested document
      ...
    },
    collection: '<data collection>',
    action: 'get',
    controller: 'read',
    requestId, '<unique request identifier>'
  }
}
```

---

###  Searching for documents

Only documents in the persistent data storage layer can be searched.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.

**Message type:** ``read``

**Query:**

```javascript
{
  action: 'search',
  collection: '<data collection>',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>,

  /*
  A set of filters or queries matching documents you're looking for.
  Use 'query' instead of 'filter' if you want to perform a query instead.
  */
  body: {
    filter: {

    }
  }
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original filter/query
      ...
    },
    hits: {                         // Your search results
      /* An array of objects containing your retrieved documents */
      hits: [
          {
            _id: '<document unique ID>',
            _source: {                // The actual document

            },
          },
          {
            // Another document... and so on
          }
        ],
        total: <number of found documents>
    }
    collection: '<data collection>',
    action: 'search',
    controller: 'read',
    requestId, '<unique request identifier>'
  }
}
```

---

###  Updating a document

Only documents in the persistent data storage layer can be updated.

**Message type:** ``write``

**Query:**

```javascript
{
  action: 'update',
  collection: '<data collection>',

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  The document unique identifier. It's the same one that Kuzzle sends you
  in its responses when you create a document, or when you do a search query.
  */
  _id: '<document ID>'

  /*
  The actual update query
  */
  body: {
    field_to_update1: 'new value',
    field_to_update2: 'new value',
    ...
  }
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _id:
    _source: {                      // Your original update query
      ...
    },
    collection: '<data collection>',
    action: 'update',
    controller: 'write',
    requestId, '<unique request identifier>'
  }
}
```

---

###  Counting documents

Only documents in the persistent data storage layer can be counted.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.


**Message type:** ``read``

**Query:**

```javascript
{
  action: 'count',
  collection: '<data collection>',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>,

  /*
  A set of filters or queries matching documents you're looking for.
  Use 'query' instead of 'filter' if you want to perform a query instead.
  */
  body: {
    filter: {

    }
  }
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    count: <number of found documents>
    _source: {                      // Your original count query
      ...
    },
    collection: '<data collection>',
    action: 'count',
    controller: 'read',
    requestId, '<unique request identifier>'
  }
}
```

---

###  Deleting a document using a document unique ID

Only documents in the persistent data storage layer can be deleted.

**Message type:** ``write``

**Query:**

```javascript
{
  action: 'delete',
  collection: '<data collection>',

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  The document unique identifier. It's the same one that Kuzzle sends you
  in its responses when you create a document, or when you do a search query.
  */
  _id: '<document ID>'
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _id: '<document ID>'            // The deleted document identifier
    _source: {                      // Your original delete query
      action: 'delete',
      collection: '<data collection>',
      controller: 'write'
    },
    collection: '<data collection>',
    action: 'delete',
    controller: 'write',
    requestId, '<unique request identifier>'
  }
}
```

---

###  Deleting documents using a query

Only documents in the persistent data storage layer can be deleted.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.


**Message type:** ``write``

**Query:**

```javascript
{
  action: 'deleteByQuery',
  collection: '<data collection>',

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  A set of filters or queries matching documents you're looking for.
  Use 'query' instead of 'filter' if you want to perform a query instead.
  */
  body: {
    filter: {

    }
  }
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original query
      ...
    },
    collection: '<data collection>',
    action: 'deleteByQuery',
    controller: 'write',
    requestId, '<unique request identifier>',

    /*
    Array of strings listing the IDs of removed documents
    */
    ids: ['id1', 'id2', ..., 'idn']
  }
}
```

---

###  Deleting an entire data collection

This removes an entire data collection in the persistent data storage layer.  
This action is handled by the **administration** controller.

**Message type:** ``admin``

**Query:**

```javascript
{
  action: 'deleteCollection',
  collection: '<data collection>',

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original query
      collection: '<data collection>',
      action: 'deleteCollection',
      controller: 'admin',
    },
    collection: '<data collection>',
    action: 'deleteCollection',
    controller: 'admin',
    requestId, '<unique request identifier>'
  }
}
```

---

###  Setting up a data mapping in a collection

When creating a new data collection in the persistent data storage layer, Kuzzle uses a default mapping.  
It means that, by default, you won't be able to exploit the full capabilities of our persistent data storage layer (currently handled by [ElasticSearch](https://www.elastic.co/products/elasticsearch)), and your searches may suffer from below-average performances, depending on the amount of data you stored in a collection and the complexity of your database.

To solve this matter, Kuzzle's API offer a way to create data mapping and expose the entire [mapping capabilities of ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/mapping.html).

This action is handled by the **administration** controller.

**Message type:** ``admin``

**Query:**

```javascript
{
  action: 'putMapping',
  collection: '<data collection>',

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  Data mapping using ElasticSearch mapping syntax
  */
  body: {
    properties: {
      field1: {type: 'field type', ...options... },
      field2: {type: 'field type', ...options... },
      ...
      fieldn: {type: 'field type', ...options... },
    }
  }
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original mapping query
      ...
    },
    collection: '<data collection>',
    action: 'putMapping',
    controller: 'admin',
    requestId, '<unique request identifier>'
  }
}
```

---

###  Retrieving the data mapping of a collection

Get data mapping of a collection previously defined

**Message type:** ``admin``

**Query:**

```javascript
{
  action: 'getMapping',
  collection: '<data collection>',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>,
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {},
    action: 'getMapping',
    collection: '<data collection>',
    controller: 'admin',
    requestId: '<unique request identifier>',

    mainindex: {
      mappings: {
        <data collection>: {

          /*
          Data mapping using ElasticSearch mapping syntax
          */
          properties: {
            field1: {type: 'field type', ...options... },
            field2: {type: 'field type', ...options... },
            ...
            fieldn: {type: 'field type', ...options... },
          }
        }
      }
    }
  }
}
```

---


### Performing a bulk import on a data collection

A bulk import allows your application to perform multiple writing operations thanks to a single query. This is especially useful if you want to create a large number of documents, as a bulk import will be a lot faster compared to creating them individually using ``create`` queries.  
As with other queries, the syntax for bulk imports closely resembles the [ElasticSearch Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/docs-bulk.html?q=bulk).

Bulk import only works on documents in our persistent data storage layer.

**Message type:** ``bulk``

**Query:**

```javascript
{
  action: 'import',
  collection: '<data collection>',

  /*
  Optional: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  Data mapping using ElasticSearch bulk syntax.
  */
  body: [
    {create: {}},
    { a: 'document', with: 'any', number: 'of fields' },
    { another: 'document' },
    { and: { another: 'one'} },
    ...
  ]
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original bulk import query
      ...
    },
    collection: '<data collection>',
    action: 'import',
    controller: 'bulk',
    requestId, '<unique request identifier>',

    /*
    The list of executed queries, with their status
    */
    items: [
      { create: {
          _id: '<document ID>',
          status: <HTTP status code>
        }
      },
      { create: {
          _id: '<document ID>',
          status: <HTTP status code>
        }
      },
      { create: {
          _id: '<document ID>',
          status: <HTTP status code>
        }
      }
    ]
  }
}
```

---

### Performing a global bulk import

The previous section covers how to perform a bulk import on a specific data collection, but you may want to execute one on a whole database, modifying multiple data collections at once.

To do that, refer to the [ElasticSearch Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/docs-bulk.html?q=bulk), using the ``_type`` argument to specify the data collection you want to modify.

Bulk import only works on documents in our persistent data storage layer.

**Message type:** ``bulk``

**Query:**

```javascript
{
  action: 'import',

  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  requestId: <Unique query ID>,

  /*
  Data mapping using ElasticSearch bulk syntax.
  */
  body: [
    {create: {"_type": "<data collection>"}},
    { a: 'document', with: 'any', number: 'of fields' },
    { another: 'document' },
    { and: { another: 'one'} },
    ...
  ]
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original bulk import query
      ...
    },
    action: 'import',
    controller: 'bulk',

    /*
    The list of executed queries, with their status
    */
    items: [
      { create: {
          _id: '<document ID>',
          status: <HTTP status code>
        }
      },
      { create: {
          _id: '<document ID>',
          status: <HTTP status code>
        }
      },
      { create: {
          _id: '<document ID>',
          status: <HTTP status code>
        }
      }
    ],

    /*
    The requestId field you provided.
    */
    requestId: '<unique request identifier>'
  }
}
```


---

### Getting the last statistics frame

Kuzzle monitors its internal activities and make snapshots regularly. This command allows getting the last stored statistics frame.  
By default, snapshots are made every 10s.

These statistics include:

* the number of connected users for protocols allowing this notion (websocket, udp, ...)
* the number of ongoing requests
* the number of completed requests since the last frame
* the number of failed requests since the last frame

**Message type:** ``admin``

**Query:**

```javascript
{
  action: 'getLastStat',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original query
      ...
    },
    action: 'getLastStat',
    controller: 'admin',
    statistics: {
      "YYYY-MM-DDTHH:mm:ss.mmmZ": {
        completedRequests: {
          websocket: 148,
          rest: 24,
          mq: 78
        },
        failedRequests: {
          websocket: 3
        },
        ongoingRequests: {
          mq: 8,
          rest: 2
        }
        connections: {
          websocket: 13
        }
      }
    },
    /*
    The requestId field you provided.
    */
    requestId: '<unique request identifier>'
  }
}
```

---

### Getting the statistics frame from a date

Kuzzle monitors its internal activities and make snapshots regularly. This command allows getting the last stored statistics frame from a date.
By default, snapshots are made every 10s.

These statistics include:

* the number of connected users for protocols allowing this notion (websocket, udp, ...)
* the number of ongoing requests
* the number of completed requests since the last frame
* the number of failed requests since the last frame

**Message type:** ``admin``

**Query:**

```javascript
{
  action: 'getStats',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>

  timestamp: 4242424242
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original query
      timestamp: 4242424242
    },
    action: 'getStats',
    controller: 'admin',
    statistics: {
      "YYYY-MM-DDTHH:mm:ss.mmmZ": {
        completedRequests: {
          websocket: 148,
          rest: 24,
          mq: 78
        },
        failedRequests: {
          websocket: 3
        },
        ongoingRequests: {
          mq: 8,
          rest: 2
        }
        connections: {
          websocket: 13
        }
      }
    },
    /*
    The requestId field you provided.
    */
    requestId: '<unique request identifier>'
  }
}
```

---

### Getting all stored statistics

Kuzzle monitors its internal activities and make snapshots regularly. This command allows getting all the stored statistics.    
By default, snapshots are made every 10s, and these snapshots are stored for 1hr.

These statistics include:

* the number of connected users for protocols allowing this notion (websocket, udp, ...)
* the number of ongoing requests
* the number of completed requests since the last frame
* the number of failed requests since the last frame

Statistics are returned as a JSON-object with each key being the snapshot's timestamp.

**Message type:** ``admin``

**Query:**

```javascript
{
  action: 'getAllStats',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original query
      ...
    },
    action: 'getAllStats',
    controller: 'admin',
    statistics: {
      "YYYY-MM-DDTHH:mm:ss.mmmZ": {
        completedRequests: {
          websocket: 148,
          rest: 24,
          mq: 78
        },
        failedRequests: {
          websocket: 3
        },
        ongoingRequests: {
          mq: 8,
          rest: 2
        }
        connections: {
          websocket: 13
        }
      },
      "YYYY-MM-DDTHH:mm:ss.mmmZ": {
        completedRequests: { ... },
        failedRequests: { ... },
        ongoingRequests: { ... }
        connections: { ... }
      },
      ...
    },
    /*
    The requestId field you provided.
    */
    requestId: '<unique request identifier>'
  }
}
```

---

### Listing all known data collections

Return the complete list of persisted data collections.

**Message type:** ``read``

**Query:**

```javascript
{
  action: 'listCollections',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    collections: [                  // An array of data collection names
      'collection_1',
      'collection_2',
      'collection_...',
      'collection_n'
    ],
    action: 'listCollection',
    controller: 'read',
    requestId: '<unique request identifier>'
  }
}
```

---

### Getting the current Kuzzle timestamp

Return the the current Kuzzle UTC timestamp as Epoch time (number of milliseconds elapsed since 1 January 1970 00:00:00)

**Message type:** ``read``

**Query:**

```javascript
{
  action: 'now',

  /*
  Required: if your query doesn't include a requestId field, Kuzzle will
  discard it, as it doesn't have any means to provide you with the result
  */
  requestId: <Unique query ID>
}
```

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    now: 1447151167622,             // Epoch time
    action: 'now',
    controller: 'read',
    requestId: '<unique request identifier>'
  }
}
```
