# Kuzzle WebSocket API Specifications

## Introduction

You can connect your application directly to Kuzzle, using WebSockets.

This will give you a direct access to Kuzzle's router controller, dispatching your queries to the right components, which in turn will send you back a ``response``


## Index

* [How to connect to Kuzzle](#how-to-connect-to-kuzzle)
* [What are response objects](#what-are-response-objects)
* [Performing queries](#performing-queries)
  * [Subscribing to documents](#subscribing-to-documents)
    * [Notifications you can receive](#notifications)
  * [Counting the number of subscriptions on a given room](#counting-the-number-of-subscriptions-on-a-given-room)
  * [Unsubscribing to a room](#unsubscribing-to-a-room)
  * [Sending a non persistent message](#sending-a-non-persistent-message)
  * [Creating a new document](#creating-a-new-document)
  * [Retrieving a document](#retrieving-a-document)
  * [Searching for documents](#searching-for-documents)
  * [Updating a document](#updating-a-document)
  * [Counting documents](#counting-documents)
  * [Deleting a document using a document unique ID](#deleting-a-document-using-a-document-unique-id)
  * [Deleting documents using a query](#deleting-documents-using-a-query)
  * [Deleting an entire data collection](#deleting-an-entire-data-collection)
  * [Setting up a data mapping on a collection](#setting-up-a-data-mapping-in-a-collection)
  * [Retrieving the data mapping of a collection](#retrieving-the-data-mapping-of-a-collection)
  * [Performing a bulk import](#performing-a-bulk-import)

## <a name="how-to-connect-to-kuzzle"></a> How to connect to Kuzzle

To establish communication with Kuzzle using WebSockets, simply connect your application to Kuzzle's WebSocket port.
By default, the router controller listens to the port 7512 for WebSocket applications.

## <a name="what-are-response-objects"></a> What are ``response`` objects

A ``response`` is the result of a query you send to Kuzzle. It may be the results of a search query, an acknowledgement of a created action, and so on.  
And when you subscribe to a room, Kuzzle also sends notifications to your application in the form of a ``response`` object.

A ``response`` is a JSON object with the following structure:

```javascript
{
  /*
  String containing an error message if something went wrong
  */
  error: null,  

  /*
  Complex object, depending on your query
  */
  result: {
    requestId: <unique ID>  // Your query unique identifier. See below.
    ...
  }
}
```

Kuzzle will respond to your application by sending a ``requestId`` message on your socket, so you should specify one to get a response. And for some queries, this argument is required, as it wouldn't have any sense for Kuzzle to not be able to send you a response (for instance, when performing a document search).

So to get a response from Kuzzle, simply add a unique ``requestId`` field to your message (for instance by using an [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier)), and then listen for a ``requestId`` message on your socket.

## <a name="performing-queries"></a> Performing queries

This section details every query you can send to Kuzzle, and the ``response`` object Kuzzle will send you back, if any.

Each query you make needs to specify:

* what ``action`` you want to perform,
* and the ``data collection`` you want to query

Moreover, you need to emit to Kuzzle a ``controller`` message, where ``controller`` is the Kuzzle component that will execute your query.

This documentation will tell you the corresponding ``controller`` and ``action``. The only thing you need to know is what a ``data collection`` is.  
Simply put, a ``data collection`` is a set of data managed internally by Kuzzle. It acts like a data table for persistent documents, or like a room for pub/sub messages.  


---

### <a name="subscribing-to-documents"></a> Subscribing to documents

Subscription works differently in Kuzzle than with a regular publish/subscribe protocol.  
In Kuzzle, you don't exactly subscribe to a room or a topic but, instead, you subscribe to documents.

What it means is that, along with your subscription query, you also give to Kuzzle a set of matching criteria.  
Once you have subscribed to a room, if a pub/sub message is published matching your criteria, or if a matching stored document changes (because it is created, updated or deleted), then you'll receive a notification about it.  
Notifications are ``response`` objects.

Of course, you may also subscribe to a ``data collection`` with no other matching criteria, and you'll effectively listen to a 'topic'.

The matching criteria you pass on to Kuzzle are [filters](./filters.md).

How subscription works:  
:arrow_right: You send a subscription query to Kuzzle  
:arrow_left: Kuzzle responds to you with a room name and a room unique ID  
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

**Response:**

```javascript
{
  error: null,                      // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    roomName: 'your request ID'
  }
}
```

#### <a name="notifications"></a> Notifications

Once you receive this ``response``, all you have to do is to listen to ``requestId`` messages on your websocket to receive notifications.

There are 4 types of notifications you can receive:

#### 'A document has been created' notification:

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    _source: {                        // The created document

    },
    action: 'create',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>'  // The query updating the document document
  }
}
```

#### 'An updated document entered your listening scope' notification:

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    _source: {                        // The updated document

    },
    action: 'update',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>'  // The query updating the document
  }
}
```

#### 'An updated document left your listening scope' notification:

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    action: 'update',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>'  // The query updating the document
    // there is no document source in this notification
  }
}
```


#### 'A document has been deleted' notification:

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    _id: 'unique document ID',
    action: 'delete',
    collection: '<data collection>',
    controller: 'write',
    requestId: '<unique request ID>'  // The query deleting the document
    // there is no document source in this notification
  }
}
```

#### 'A user entered a room' notification:

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    roomName: 'the new user room ID',
    controller: 'subscribe',
    action: 'on',
    count: <the new user count on that room>,
  }
}
```
#### 'A user left a room' notification:

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    roomName: 'the exiting user room ID',
    controller: 'subscribe',
    action: 'off',
    count: <the new user count on that room>,
  }
}
```

---

### <a name="counting-the-number-of-subscriptions-on-a-given-room"></a> Counting the number of subscriptions on a given room

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
  error: null,                        // Assuming everything went well
  result: <number of subscriptions>
}
```

---

### <a name="unsubscribing-to-a-room"></a> Unsubscribing to a room

Makes Kuzzle remove you from its subscribers on this room.

**Message type:** ``subscribe``

**Query:**

```javascript
{
  action: 'off',
  collection: '<data collection>',

  /*
  Required. Represents the request ID of the subscription query.
  It's also your room name.
  */
  requestId: 'room name',
}
```

**Response:**

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    roomName: 'your room name'
  }
}
```

---

### <a name="sending-a-non-persistent-message"></a> Sending a non persistent message

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

### <a name="creating-a-new-document"></a> Creating a new document

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
  error: null,                      // Assuming everything went well
  result: {
    _id: '<Unique document ID>',    // The generated document ID
    _source: {                      // The created document
      ...
    },
    collection: '<data collection>',
    action: 'create',
    controller: 'write',
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="retrieving-a-document"></a> Retrieving a document

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

### <a name="searching-for-documents"></a> Searching for documents

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

### <a name="updating-a-document"></a> Updating a document

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

### <a name="counting-documents"></a> Counting documents

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

### <a name="deleting-a-document-using-a-document-unique-id"></a> Deleting a document using a document unique ID

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

### <a name="deleting-documents-using-a-query"></a> Deleting documents using a query

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

### <a name="deleting-an-entire-data-collection"></a> Deleting an entire data collection

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

### <a name="setting-up-a-data-mapping-in-a-collection"></a> Setting up a data mapping in a collection

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

### <a name="retrieving-the-data-mapping-of-a-collection"></a> Retrieving the data mapping of a collection

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


### <a name="performing-a-bulk-import"></a> Performing a bulk import

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
