# Kuzzle STOMP API Specifications

## Introduction

Kuzzle fully supports the [STOMP](https://stomp.github.io/) protocol, with no loss of functionalities over other means of communications. That means that you can fully and easily use Kuzzle with STOMP.

Kuzzle embeds a MQ Broker service layer, supporting a variety of MQ protocols. This broker is a 2-way mean of communication between your application and Kuzzle, forwarding your queries to Kuzzle, and notifications/responses from Kuzzle back to your application.

The current implementation of our MQ Broker service uses [RabbitMQ](https://www.rabbitmq.com) with the [RabbitMQ STOMP plugin](https://www.rabbitmq.com/stomp.html)

**Note:** Have a look at the file [MQ-broker](MQ-broker.md) for a quick explanation of how to activate this protocol in Kuzzle

## Index

* [How to connect to Kuzzle](#how-to-connect-to-kuzzle)
* [Query syntax](#query-syntax)
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
  * [Creating an empty collection](#creating-an-empty-collection)
  * [Deleting the entire content of a collection](#deleting-the-entire-content-of-a-collection)

## How to connect to Kuzzle

To establish communication with Kuzzle using STOMP, simply connect your application to the Kuzzle's STOMP port.
By default, the MQ Broker listens to the port 61613 for STOMP applications.

## Query syntax

The MQ Broker layer listens to a specific topic in order to forward your queries to the right Kuzzle controller.

**Topic:** ``/exchange/amq.topic/kuzzle``

**Query body syntax (JSON data):**
```javascript
{
  /*
  Optional
  */
  clientId: <Unique connection ID>,

  /*
  Optional: Kuzzle will create a unique ID if you don't provide one,
    and forward this field in its response, allowing you
    to easily identify which query generated the response you got.
  */
  requestId: <Unique ID>,

  /*
  Required: Controller and Action to call:
  */
  controller: '<controller>',
  action: '<action>',

  /*
  Collection on which the action is handled (empty for actions that do not manage a unique collection)
  */
  collection: '<data collection>',

  /*
  A set of filters matching documents you want to listen to
  */
  body: {

  }
}
```

What that means is that you ask a Kuzzle ``controller`` to perform an ``action`` on a ``data collection``.

##  What are ``response`` objects

A ``response`` is the result of a query you send to Kuzzle. It may be the results of a search query, an acknowledgement of a created action, and so on.  
When you subscribe to a room, Kuzzle also sends a notification to your application in the form of a ``response`` object.

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
    requestId: <unique ID>  // Your query unique identifier. See above.
    ...
  }
}
```

_NB: For more details about status code and error object, see [status-codes.md](status-codes.md)_

In order to get responses from Kuzzle, you have to provide a ``reply-to`` topic name in your message headers. If you don't, Kuzzle will have no way to reply to you and may even discard your queries if a response is necessary.

To get responses from Kuzzle, simply subscribe to the queue ``/queue/<reply-to queue you provided>``.

Once you subscribed to your response topic, you may want to send multiple queries asynchronously to Kuzzle, and to distinguish what response refers to what query.  
To do that, simply add a unique ``requestId`` field to your queries. Kuzzle will send it back in its response!

## Sending metadata

In every request you send to Kuzzle, you can include a ``metadata`` object. This object content will be ignored by Kuzzle, but it will also be forwarded back in ``responses`` and in ``notifications`` (see below).

You can also include metadata information to a subscription request. These metadata information will be forwarded to other subscribers at the moment of the subscription, and when you leave the room. Please note that when leaving the room, the forwarded metadata are those provided in the **subscription** request.

This feature is especially useful to include volatile information about the performed request.

For example, if you update a document:

```javascript
{
  clientId: 'myVeryUniqueClientID',
  action: 'update',
  collection: '<data collection>',
  controller: 'write',
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
  clientId: 'myVeryUniqueClientID',
  controller: 'subscribe',
  collection: '<data collection>',
  action: 'on',
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
    roomId: 'uniqueKuzzleRoomID',
    controller: 'subscribe',
    action: 'off',
    count: <the new user count on that room>,
    metadata: {
      hello: 'my name is Bob'
    }
  }
}
```

## Performing queries

This section details every query you can send to Kuzzle, and the ``response`` object Kuzzle will send you back, if any.

---

### Subscribing to documents

Subscription works differently in Kuzzle than with a regular publish/subscribe protocol.  
In Kuzzle, you don't exactly subscribe to a room or to a topic but, instead, you subscribe to documents.

What it means is that, along with your subscription query, you also give to Kuzzle a set of matching criteria.  
Once you have subscribed to a room, if a pub/sub message is published matching your criteria, or if a matching stored document changes (because it is created, updated or deleted), then you'll receive a notification about it.  
Notifications are ``response`` objects.

Of course, you may also subscribe to a ``data collection`` with no other matching criteria, and you'll effectively listen to a 'topic'.

The matching criteria you pass on to Kuzzle are [filters](./filters.md).

How subscription works:  
:arrow_right: You send a subscription query to Kuzzle  
:arrow_left: Kuzzle responds to you with a room unique ID  
:arrow_right: You subscribe to the queue ``/queue/<reply-to queue you provided>``
:arrow_left: When a document matches your room criterias, Kuzzle sends you a ``response``

**reply-to queue header:** Required.

**Query:**

```javascript
{
  /*
  Required. Allow Kuzzle to know which client wants to subscribe.
  */
  clientId: '<your unique client ID>',

  controller: 'subscribe',
  action: 'on',
  collection: '<data collection>',
  body: {
    // subscription filters
  },
  metadata: {
    // query metadata
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

#### Notifications

Once you receive this ``response``, all you have to do is to subscribe to the ``/topic/<roomId>`` topic to receive notifications.

There are 4 types of notifications you can receive:

#### 'A document has been created' notification:

```javascript
{
  status: 200,                        // Assuming everything went well
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    _source: {                        // The created document

    },
    action: 'create',
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

#### 'An updated document entered your listening scope' notification:

```javascript
{
  status: 200,                        // Assuming everything went well
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
  status: 200,                        // Assuming everything went well
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
  status: 200,                        // Assuming everything went well
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
  status: 200,                        // Assuming everything went well
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
  status: 200,                        // Assuming everything went well
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

### Counting the number of subscriptions on a given room

Return the number of people/applications who have subscribed to the same documents as you.

It works with the room unique ID Kuzzle returns to you when you make a subscription.

**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'subscribe',
  action: 'count'
  collection: '<data collection>'

  body: {
    roomId: 'unique room ID'
  }
  metadata: {
    // query metadata
  }
}
```

**Response:**

```javascript
{
  status: 200,                        // Assuming everything went well
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

**reply-to queue header:** Optionnal

**Query:**

```javascript
{
  /*
  Required. Allow Kuzzle to know which client wants to unsubscribe.
  */
  clientId: '<your unique client ID>',

  controller: 'subscribe',
  action: 'off',
  collection: '<data collection>',
  body: {
    roomId: 'unique room ID'
  },
  metadata: {
    // query metadata
  }
}
```

**Response:**

```javascript
{
  status: 200,                        // Assuming everything went well
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

### Sending a non persistent message

**reply-to queue header:** Ignored by Kuzzle

**Query:**

```javascript
{
  controller: 'write',
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

**Response:** Kuzzle doesn't send a response when sending a non persistent message.

---

### Creating a new document

Creates a new document in the persistent data storage. Returns an error if the document already exists.

**reply-to queue header:** Optionnal

**Query:**

```javascript
{
  controller: 'write',
  action: 'create',
  collection: '<data collection>',

  // Tells Kuzzle to store your document
  persist: true,

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

**reply-to queue header:** Optionnal

**Query:**

```javascript
{
  controller: 'write',
  action: 'createOrUpdate',
  collection: '<data collection>',

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

### Retrieving a document

Only documents in the persistent data storage layer can be retrieved.

**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'read',
  action: 'get',
  collection: '<data collection>',

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

### Searching for documents

Only documents in the persistent data storage layer can be searched.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.


**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'read',
  action: 'search',
  collection: '<data collection>',

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

### Updating a document

Only documents in the persistent data storage layer can be updated.

**reply-to queue header:** Optionnal.

**Query:**

```javascript
{
  controller: 'write',
  action: 'update',
  collection: '<data collection>',

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

### Counting documents

Only documents in the persistent data storage layer can be counted.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.


**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'read',
  action: 'count',
  collection: '<data collection>',

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

### Deleting a document using a document unique ID

Only documents in the persistent data storage layer can be deleted.

**reply-to queue header:** Optionnal.

**Query:**

```javascript
{
  controller: 'write',
  action: 'delete',
  collection: '<data collection>',

  /*
  The document unique identifier. It's the same one that Kuzzle sends you
  in its response when you create a document, or when you do a search query.
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

### Deleting documents using a query

Only documents in the persistent data storage layer can be deleted.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.


**reply-to queue header:** Optionnal.

**Query:**

```javascript
{
  controller: 'write',
  action: 'deleteByQuery',
  collection: '<data collection>',

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

### Deleting an entire data collection

This removes an entire data collection in the persistent data storage layer.  
This action is handled by the **administration** controller.

**reply-to queue header:** Optionnal.

**Query:**

```javascript
{
  controller: 'admin',
  action: 'deleteCollection',
  collection: '<data collection>'
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

### Setting up a data mapping in a collection

When creating a new data collection in the persistent data storage layer, Kuzzle uses a default mapping.  
It means that, by default, you won't be able to exploit the full capabilities of our persistent data storage layer (currently handled by [ElasticSearch](https://www.elastic.co/products/elasticsearch)), and your searches may suffer from below-average performances, depending on the amount of data you stored in a collection and the complexity of your database.

To solve this matter, Kuzzle's API offers a way to create data mapping and to expose the entire [mapping capabilities of ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/mapping.html).

This action is handled by the **administration** controller.

**reply-to queue header:** Optionnal.

**Query:**

```javascript
{
  controller: 'admin',
  action: 'putMapping',
  collection: '<data collection>',

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

### Retrieving the data mapping of a collection

Get data mapping of a collection previously defined

**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'admin',
  action: 'getMapping',
  collection: '<data collection>'
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

A bulk import allows your application to perform multiple writing operations thanks to a single query. This is especially useful if you want to create a large number of documents. A bulk import will be a lot faster compared to creating them individually using ``create`` queries.  
For other queries, the syntax for bulk imports closely resembles the [ElasticSearch Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/docs-bulk.html?q=bulk).

Bulk import only works on documents in our persistent data storage layer.

**reply-to queue header:** Optionnal.

**Query:**

```javascript
{
  controller: 'bulk',
  action: 'import',
  collection: '<data collection>',

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

**reply-to queue header:** Optionnal.

**Query:**

```javascript
{
  controller: 'bulk',
  action: 'import',

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

Kuzzle monitors its internal activities and make snapshots of them. This command allows getting the last stored statistics frame.

These statistics include:

* the number of connected users for protocols allowing this notion (websocket, udp, ...)
* the number of ongoing requests
* the number of completed requests since the last frame
* the number of failed requests since the last frame

**Topic:** ``/exchange/amq.topic/admin.getLastStat``
**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'admin',
  action: 'getStats'
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

### Getting the statistics from a date

Kuzzle monitors its internal activities and make snapshots of them. This command allows getting the last stored statistics frame from a date.

These statistics include:

* the number of connected users for protocols allowing this notion (websocket, udp, ...)
* the number of ongoing requests
* the number of completed requests since the last frame
* the number of failed requests since the last frame

**Topic:** ``/exchange/amq.topic/admin..getStats``

**reply-to queue metadata:** Required.

**Query:**

```javascript
{
  /*
  Optionnal
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
  */
  requestId: <Unique query ID>,

  body: {
    since: 4242424242
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
      since: 4242424242
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

**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'admin',
  action: 'getAllStats'
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

**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'read',
  action: 'listCollections'
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

**reply-to queue header:** Required.

**Query:**

```javascript
{
  controller: 'read',
  action: 'now'
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


---

### Creating an empty collection

When creating a document, Kuzzle will automatically create a data collection if needed.  
But in some cases, you may want to create an empty collection directly, prior to storing any document in it.

This method does nothing if the collection already exists.

**replyTo queue header:** Optionnal

**Query:**

```javascript
{
  controller: 'write',
  action: 'createCollection',
  collection: 'collection name'
}
```

**Response:**

```javascript
{
  status: 200,
  error: null,
  result: {
    acknowledged: true,
    action: 'createCollection',
    controller: 'write',
    collection: 'collection name',
    requestId: '<unique request identifier>'
  }
}
```


---

### Deleting the entire content of a collection

This method empties a collection from all its documents, while keeping any associated mapping.  
It is also way faster than deleting all documents from a collection using a query.

**replyTo queue header:** Optionnal

**Query:**

```javascript
{
  controller: 'admin',
  action: 'truncateCollection',
  collection: 'collection name'
}
```

**Response:**

```javascript
{
  status: 200,
  error: null,
  result: {
    acknowledged: true,
    action: 'truncateCollection',
    controller: 'admin',
    collection: 'collection name',
    requestId: '<unique request identifier>'
  }
}
```
