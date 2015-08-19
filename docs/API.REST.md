# Kuzzle REST API Specifications

## Introduction

You can connect your application directly to Kuzzle, using REST.

This will give you a direct access to Kuzzle's router controller, dispatching your queries to the right components, which in turn will send you back a ``response``

**NOTE:** Due to REST protocol synchronous nature, some Kuzzle functionalities won't be available to you. Namely, you won't be able to subscribe to document modifications and receive asynchronous notifications.  
If you need such functionalities, please check our other supported protocols. For instance you may easily use REST for your day to day operations, and use our [WebSocket API](./API.WebSocket.md) to manage document subscriptions.

## Index
* [What are responses objects](#what-are-responses-objects) 
<!--For the group of words "response objects" the word "response" works is an adjective so it is invariable-->
* [Performing queries](#performing-queries)
  * [Sending a publish/subscribe message](#sending-a-publish-subscribe-message)
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


##<a name="what-are-responses-objects"></a> What are ``response`` objects
<!-- "response objects" cf. line 14-->

A ``response`` is the result of a query you send to Kuzzle. It may be the results of a search query, an acknowledgement of a created action, and so on.  

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
    ...
  }
}
```

##<a name="performing-queries"></a> Performing queries

This section details every query you can send to Kuzzle, and the ``response`` object Kuzzle will send you back, if any.

All query URLs start like this: ``http://<kuzzle host>:7512/api/<data collection>/<query action>``
<!-- Shouldn't it be "All URL queries start like this-->
This documentation describes the corresponding URL for each possible query action, and the posting method to use. The only thing you need to know is what a ``data collection`` is.

Simply put, a ``data collection`` is a set of data managed internally by Kuzzle. It acts like a data table for persistent documents, or like a room for pub/sub messages.


---

###<a name="sending-a-publish-subscribe-message"></a> Sending a publish/subscribe message

**URL:** ``http://kuzzle:7512/api/<data collection>``

**Method:** ``POST``

**Message:**

```javascript  
{
  // Tells Kuzzle to send a pub/sub message
  persist: false,

  body: {
    /*
    The document itself
    */
  }
}
```

**Response:** Kuzzle doesn't send a response when sending publish/subscribe messages.

---

###<a name="creating-a-new-document"></a> Creating a new document

**URL:** ``http://kuzzle:7512/api/<data collection>``

**Method:** ``POST``

**Message:**

```javascript  
{

  // Tells Kuzzle to not store your document
  <!--"not to store"-->
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

###<a name="retrieving-a-document"></a> Retrieving a document

Only documents in the persistent data storage layer can be retrieved.

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>``

**Method:** ``GET``

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

###<a name="searching-for-documents"></a> Searching for documents

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

###<a name="updating-a-document"></a> Updating a document

Only documents in the persistent data storage layer can be updated.

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>``

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

###<a name="counting-documents"></a> Counting documents

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

###<a name="deleting-a-document-using-a-document-unique-id"></a> Deleting a document using a document unique ID

Only documents in the persistent data storage layer can be deleted.

**URL:** ``http://kuzzle:7512/api/<data collection>/<document unique ID>``

**Method:** ``DELETE``

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

###<a name="deleting-documents-using-a-query"></a> Deleting documents using a query

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

###<a name="deleting-an-entire-data-collection"></a> Deleting an entire data collection

This removes an entire data collection in the persistent data storage layer.  

**URL:** ``http://kuzzle:7512/api/<data collection>``

**Method:** ``DELETE``

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

###<a name="setting-up-a-data-mapping-in-a-collection"></a> Setting up a data mapping in a collection

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

###<a name="retrieving-the-data-mapping-of-a-collection"></a> Retrieving the data mapping of a collection

Get data mapping of a collection previously defined

**URL:** ``http://kuzzle:7512/api/<data collection>/_mapping``

**Method:** ``GET``

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

###<a name="performing-a-bulk-import"></a> Performing a bulk import

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
