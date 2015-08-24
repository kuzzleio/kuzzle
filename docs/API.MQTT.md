# Kuzzle MQTT API Specifications

## Introduction

Kuzzle fully supports the [MQTT](http://mqtt.org/) protocol, with no loss of functionalities over other means of communications. That means that you can fully and easily use Kuzzle with MQTT.

Kuzzle embeds a MQ Broker service layer, supporting a variety of MQ protocols. This broker is a 2-way mean of communication between your application and Kuzzle, forwarding your queries to Kuzzle, and notifications/responses from Kuzzle back to your application.

The current implementation of our MQ Broker service uses [RabbitMQ](https://www.rabbitmq.com), with the [RabbitMQ MQTT Adapter](https://www.rabbitmq.com/mqtt.html).

## Index

* [How to connect to Kuzzle](#how-to-connect-to-kuzzle)
* [What are responses objects](#what-are-responses-objects)
* [Performing queries](#performing-queries)
  * [Subscribing to documents](#subscribing-to-documents)
    * [Notifications you can receive](#notifications)
  * [Counting the number of subscriptions on a given room](#counting-the-number-of-subscriptions-on-a-given-room)
  * [Unsubscribing of a room](#unsubscribing-of-a-room)
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
  * [Retriveing the data mapping of a collection](#retrieving-the-data-mapping-of-a-collection)
  * [Performing a bulk import](#performing-a-bulk-import)

## <a name="how-to-connect-to-kuzzle"></a> How to connect to Kuzzle

To establish communication with Kuzzle using MQTT, simply connect your application to the Kuzzle's MQTT port.
By default, the MQ Broker listens to the port 1883 for MQTT applications.

## <a name="what-are-responses-objects"></a>What are responses objects

A ``response`` is the result of a query you send to Kuzzle. It may be the results of a search query, an acknowledgement of a create action, and so on.  
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

Because the MQTT specification doesn't include any way of getting back a response (for instance, a reply-to channel name like with other MQ protocols), we had to specify our own way to send responses and notifications to your application.

For this purpose, all queries you send to Kuzzle should include a ``clientId`` value, and this ID should be unique, for instance a [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier). If you don't indicate one, Kuzzle will have no way of getting back to you.

To get responses from Kuzzle, simply subscribe to the room ``mqtt.<your unique clientId>``.

Once you subscribed to your response topic, you may want to send multiple queries asynchronously to Kuzzle, and to distinguish what response refers to what query.  
To do that, simply add a unique ``requestId`` field to your queries. Kuzzle will send it back in its response!

## <a name="performing-queries"></a> Performing queries

This section details every query you can send to Kuzzle, and the ``response`` object Kuzzle will send you back, if any.

The MQ Broker layer listens to specific topics in order to forward your queries to the right Kuzzle controller.

Kuzzle topics are named like this: ``<controller>.<data collection>.<action>``  
What that means is that you ask a Kuzzle ``controller`` to perform an ``action`` on a ``data collection``.

This documentation will tell you to what topic your queries need to be sent. The only thing you need to know is what a ``data collection`` is.  
Simply put, a ``data collection`` is a set of data managed internally by Kuzzle. It acts like a data table for persistent documents, or like a room for pub/sub messages.  


---

### <a name="subscribing-to-documents"></a> Subscribing to documents

Subscription doesn't work the same way in Kuzzle than with a regular publish/subscribe protocol.  
In Kuzzle, you don't exactly subscribe to a room or a topic but, instead, you subscribe to documents.

What it means is that, along with your subscription query, you also give to Kuzzle a set of matching criterias.  
Once you have subscribed to a room, if a pub/sub message is published matching your criterias, or if a matching stored document change (because it is created, updated or deleted), then you'll receive a notification about it.  
Notifications are ``response`` objects.

Of course, you may also subscribe to a ``data collection`` with no other matching criteria, and you'll effectively listen to a 'topic'.

The matching criterias you pass on to Kuzzle follow the [ElasticSearch filter API](https://www.elastic.co/guide/en/elasticsearch/client/java-api/1.3/query-dsl-filters.html)

How subscription works:  
:arrow_right: You send a subscription query to Kuzzle  
:arrow_left: Kuzzle responds to you with a room name and a room unique ID  
:arrow_right: You subscribe to the topic ``mqtt.<room name>``  
:arrow_left: When a document matches your room criterias, Kuzzle sends you a ``response``

**Topic:** ``subscribe.<data collection>.on``

**Query:**

```javascript
{
  /*
  Required. If your query doesn't include a clientId field, Kuzzle
  will discard your query, because it doesn't have any mean to send you
  the resulting room ID.
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will create an unique ID if you don't provide one.
  If you do, the requestId will be treated by Kuzzle as a room name.
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
    roomName: 'your request ID, or a Kuzzle auto-generated ID'
  }
}
```

#### <a name="notifications"></a> Notifications

Once you receive this ``response``, all you have to do is to subscribe to the ``<provided room name>`` topic to receive notifications.

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
    requestId: '<unique request ID>'  // The query ID that updated the document
    // there is no document source in this notification
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
    requestId: '<unique request ID>'  // The query that updated the document
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
    requestId: '<unique request ID>'  // The query that updated the document
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
    requestId: '<unique request ID>'  // The query that updated the document
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
    controller: 'subscribe',
    action: 'off',
    count: <the new user count on that room>,
  }
}
```

---

### <a name="counting-the-number-of-subscriptions-on-a-given-room"></a> Counting the number of subscriptions on a given room

Returns the number of people/applications who have subscribed to the same documents than you.

It works with the room unique ID Kuzzle returns to you when you make a subscription.

**Topic:** ``subscribe.<data collection>.count``

**Query:**

```javascript
{
  /*
  Required. If your query doesn't include a clientId field, Kuzzle
  will discard your query, because it doesn't have any mean to send you
  the result.
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
  */
  requestId: <Unique query ID>,

  /*
  The document unique identifier. It's the same one that Kuzzle sends you
  in its responses when you create a document, or when you do a search query.
  */
  body: {
    roomId: 'internal Kuzzle room ID'
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

### <a name="unsubscribing-of-a-room"></a> Unsubscribing of a room

Makes Kuzzle remove you of its subscribers on this room.

**Topic:** ``subscribe.<data collection>.off``

**Query:**

```javascript
{
  /*
  Required. Represents the request ID of the subscription query.
  It's also your room name.
  */
  requestId: 'room name',

  /*
  Required. Allow Kuzzle to know which client want to unsubscribe.
  */
  clientId: '<your unique client ID>'
}
```

**Response:**

```javascript
{
  error: null,                        // Assuming everything went well
  result: {
    roomId: 'unique Kuzzle room ID',
    roomName: 'your request ID, or a Kuzzle auto-generated ID'
  }
}
```

---

### <a name="sending-a-non-persistent-message"></a> Sending a non persistent message

**Topic:** ``write.<data collection>.create``

**Query:**

```javascript
{
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

**Topic:** ``write.<data collection>.create``

**Query:**

```javascript
{
  // Tells Kuzzle to store your document
  persist: true,

  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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
    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="retrieving-a-document"></a> Retrieving a document

Only documents in the persistent data storage layer can be retrieved.

**Topic:** ``read.<data collection>.get``

**Query:**

```javascript
{
  /*
  Required. If your query doesn't include a clientId field, Kuzzle
  will discard your query, because it doesn't have any mean to send you
  the result.
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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
    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="searching-for-documents"></a> Searching for documents

Only documents in the persistent data storage layer can be searched.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.

**Topic:** ``read.<data collection>.search``

**Query:**

```javascript
{
  /*
  Required. If your query doesn't include a clientId field, Kuzzle
  will discard your query, because it doesn't have any mean to send you
  the result.
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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
    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="updating-a-document"></a> Updating a document

Only documents in the persistent data storage layer can be updated.

**Topic:** ``write.<data collection>.update``

**Query:**

```javascript
{
  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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
    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="counting-documents></a> Counting documents

Only documents in the persistent data storage layer can be counted.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.


**Topic:** ``read.<data collection>.count``

**Query:**

```javascript
{
  /*
  Required. If your query doesn't include a clientId field, Kuzzle
  will discard your query, because it doesn't have any mean to send you
  the result.
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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
    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="deleting-a-document-using-a-document-unique-id"></a> Deleting a document using a document unique ID

Only documents in the persistent data storage layer can be deleted.

**Topic:** ``write.<data collection>.delete``

**Query:**

```javascript
{
  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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

    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="deleting-documents-using-a-query"></a> Deleting documents using a query

Only documents in the persistent data storage layer can be deleted.

Kuzzle uses the [ElasticSearch Query DSL ](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/query-dsl.html) syntax.


**Topic:** ``write.<data collection>.deleteByQuery``

**Query:**

```javascript
{
  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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

    /*
    Array of strings listing the IDs of removed documents
    */
    ids: ['id1', 'id2', ..., 'idn'],

    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="deleting-an-entire-data-collection"></a> Deleting an entire data collection

This removes an entire data collection in the persistent data storage layer.  
This action is handled by the **administration** controller.

**Topic:** ``admin.<data collection>.deleteCollection``

**Query:**

```javascript
{
  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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

    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="setting-up-a-data-mapping-in-a-collection"></a> Setting up a data mapping in a collection

When creating a new data collection in the persistent data storage layer, Kuzzle uses a default mapping.  
It means that, by default, you won't be able to exploit the full capabilities of our persistent data storage layer (currently handled by [ElasticSearch](https://www.elastic.co/products/elasticsearch)), and your searches may suffer from below-average performances, depending on the amount of data you stored in a collection and the complexity of your database.

To solve this matter, Kuzzle's API offer a way to create a data mapping. It exposes the entire [mapping capabilities of ElasticSearch](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/mapping.html).

This action is handled by the **administration** controller.

**Topic:** ``admin.<data collection>.putMapping``

**Query:**

```javascript
{
  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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

    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```

---

### <a name="retrieving-the-data-mapping-of-a-collection"></a> Retrieving the data mapping of a collection

Get data mapping of a collection previously defined

**Topic:** ``admin.<data collection>.getMapping``

**Query:**

```javascript
{
  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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
    },

    /*
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId: '<unique request identifier>'
  }
}
```

---

### <a name="performing-a-bulk-import"></a> Performing a bulk import

A bulk import allow your application to perform multiple writing operations with a single query. This is especially useful if you want to create a large number of documents, as a bulk import will be a lot faster compared to creating them individually using ``create`` queries.  
As with other queries, the syntax for bulk imports closely ressembles the [ElasticSearch Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/1.3/docs-bulk.html?q=bulk).

Bulk import only works on documents in our persistent data storage layer.

**Topic:** ``bulk.<data collection>.import``

**Query:**

```javascript
{
  /*
  Optionnal: allow Kuzzle to send a response to your application
  */
  clientId: <Unique session ID>,

  /*
  Optionnal: Kuzzle will forward this field in its response, allowing you
  to easily identify what query generated the response you got.
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
    The requestId field you provided. If you didn't, Kuzzle generates
    an unique query identifier anyway.
    */
    requestId, '<unique request identifier>'
  }
}
```
