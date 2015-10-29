# Kuzzle REST API Specifications

## Introduction

You can connect your application directly to Kuzzle using REST.

This will give you a direct access to Kuzzle's router controller, dispatching your queries to the right components, which in turn will send you back a ``response``

**NOTE:** Due to REST protocol synchronous nature, some Kuzzle functionalities won't be available to you. Namely, you won't be able to subscribe to document modifications and receive asynchronous notifications.  
If you need such functionalities, please check our other supported protocols. For instance you may easily use REST for your day to day operations, and use our [WebSocket API](./API.WebSocket.md) to manage document subscriptions.

## Index
* [What are response objects](#what-are-response-objects)
* [Performing queries](#performing-queries)
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
  * [Getting all stored statistics](#getting-all-stored-statistics)
  * [Listing all known data collections](#listing-all-known-data-collections)

## What are ``response`` objects

A ``response`` is the result of a query you send to Kuzzle. It may be the results of a search query, an acknowledgement of a created action, and so on.  

A ``response`` is a JSON object with the following structure:

```javascript
{
  /*
  Integer containing the status code, also used as HTTP status response Header (200 if OK, 4xx or 5xx in case of error)
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
    ...
  }
}
```

_NB: For more details about status code and error object, see [status-codes.md](status-codes.md)_

## Performing queries

This section details every query you can send to Kuzzle, and the ``response`` object Kuzzle will send you back, if any.

All URL queries start like this: ``http://<kuzzle host>:7512/api/<data collection>/<query action>``

This documentation describes the corresponding URL for each possible query action, and the posting method to use. The only thing you need to know is what a ``data collection`` is.

Simply put, a ``data collection`` is a set of data managed internally by Kuzzle. It acts like a data table for persistent documents, or like a room for pub/sub messages.


---

### Sending a non persistent message

**URL:** ``http://kuzzle:7512/api/<data collection>``

**Method:** ``POST``

**Message:**

```javascript  
{
  // Tells Kuzzle to send a non persistent message
  persist: false,

  body: {
    /*
    The document itself
    */
  }
}
```

**Response:** Kuzzle doesn't send a response when sending non persistent message.

---

### Creating a new document

Creates a new document in the persistent data storage. Returns an error if the document already exists.

**URL:** ``http://kuzzle:7512/api/<data collection>``

**Method:** ``POST``

**Message:**

You can directly send your document through post data using default parameters (persist: true)

```javascript
{
  /*
  The document itself
  */
}
```

Or instead control the behavior of the document by passing your document in the body field.

```javascript  
{
  // Tells Kuzzle to store your document
  persist: true,

  body: {
    /*
    The document itself
    */
  }
  ...
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

You may use a different route to create documents. This requires that you force the document ID:

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>/_create``

**Method:** ``PUT``

Everything else stays the same.

---

###  Creating or Updating a document

Creates a new document in the persistent data storage, or update it if it already exists.

**URL:** ``http://kuzzle:7512/api/<data collection>/<documentId>``

**Method:** ``PUT``

**Message:**
```javascript  
{
  /*
  The document itself
  */
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

You may use a different route to create or update documents:

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>/_createOrUpdate``

**Method:** ``PUT``

Everything else stays the same.

---

### Retrieving a document

Only documents in the persistent data storage layer can be retrieved.

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>``

**Method:** ``GET``

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

**URL:** ``http://kuzzle:7512/api/<data collection>/_search``

**Method:** ``POST``

**Message:**

```javascript
{
  /*
  A set of filters or queries matching documents you're looking for.
  Use 'query' instead of 'filter' if you want to perform a query instead.
  */
  filter: {

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

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>/_update``

**Method:** ``PUT``

**Message:**

```javascript
{
  field_to_update1: 'new value',
  field_to_update2: 'new value',
  ...
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

**URL:** ``http://kuzzle:7512/api/<data collection>/_count``

**Method:** ``POST``

**Message:**

```javascript
{
  /*
  A set of filters or queries matching documents you're looking for.
  Use 'query' instead of 'filter' if you want to perform a query instead.
  */
  filter: {

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

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>``

**Method:** ``DELETE``

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

Alternative route:

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>/_delete``

**Method:** ``PUT``

---

### Deleting documents using a query

Only documents in the persistent data storage layer can be deleted.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.

**URL:** ``http://kuzzle:7512/api/<data collection>/_query``

**Method:** ``DELETE``

**Message:**

```javascript
  /*
  A set of filters or queries matching documents you're looking for.
  Use 'query' instead of 'filter' if you want to perform a query instead.
  */
  filter: {

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

**URL:** ``http://kuzzle:7512/api/<data collection>``

**Method:** ``DELETE``

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

To solve this matter, Kuzzle's API offer a way to create data mapping and expose the entire [mapping capabilities of ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/mapping.html).

This action is handled by the **administration** controller.

**URL:** ``http://kuzzle:7512/api/<data collection>/_mapping``

**Method:** ``PUT``

**Message:**

```javascript
{
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

**URL:** ``http://kuzzle:7512/api/<data collection>/_mapping``

**Method:** ``GET``

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

**URL:** ``http://kuzzle:7512/api/<data collection>/_bulk``

**Method:** ``POST``

**Message:**

```javascript
{
  /*
  Data mapping using ElasticSearch bulk syntax.
  */
  [
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

**URL:** ``http://kuzzle:7512/api/_bulk``

**Method:** ``POST``

**Message:**

```javascript
{
  /*
  Data mapping using ElasticSearch bulk syntax.
  */
  [
    {create: {"_type": "<data collection>"}},
    { a: 'document', with: 'any', number: 'of fields' },
    { another: 'document' },
    { and: { another: 'one'} },
    ...
    {create: {"index": { "_index": "mainindex", "_type": <another data collection>""}}},
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
    ]
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

**URL:** ``http://kuzzle:7512/api/_getStats``

**Method:** ``GET``

**Response:**

```javascript
{
  status: 200,                      // Assuming everything went well
  error: null,                      // Assuming everything went well
  result: {
    _source: {                      // Your original count query
      ...
    },
    collection: '<data collection>',
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
    requestId, '<unique request identifier>'
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

**URL:** ``http://kuzzle:7512/api/_getAllStats``

**Method:** ``GET``

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

**URL:** ``http://kuzzle:7512/api/_listCollections``

**Method:** ``GET``

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
