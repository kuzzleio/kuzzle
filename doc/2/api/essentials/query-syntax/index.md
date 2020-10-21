---
code: false
type: page
title: Query Syntax
description: Kuzzle query format
order: 200
---

# Query Syntax

Except for HTTP, Kuzzle expects the exact same query format for all communication protocols.

---

## HTTP

HTTP queries are split into the four HTTP usual parts: URL, verb, headers and body.

Every API action documentation has a dedicated HTTP section, explaining how to use that action with the HTTP protocol.

### Optional headers

The following list of HTTP headers can be added to any and all HTTP requests:

- `Accept-Encoding`: compression algorithm(s) usable by Kuzzle to encode the query response. Accepted encodings, in order of preference: `gzip`, `deflate`, `identity`.
- `Authorization` (expected value: `Bearer <token>`): user's authentification token, obtained through the [login](/core/2/api/controllers/auth/login) method
- `Content-Encoding`: compression algorithm(s) used to encode the body sent to Kuzzle. Accepted encodings: `deflate`, `gzip`, `identity`

### Body encoding

Body contents can be sent in the following formats:

- `application/json`: raw JSON
- `multipart/form-data`: HTML forms; both field-value pairs and field-files pairs can be sent that way

If a HTML form is sent that way, the resulting body content will be translated into a JSON object, with as many keys as the provided form fields.
If the form field holds a file, then the corresponding JSON key will refer to an object instead of a mere value, with the following properties:

- `filename`: file's name
- `encoding`: file encoding
- `mimetype`: MIME type
- `file`: file content, encoded in base64

### JSON query endpoint

Kuzzle also exposes an endpoint to send queries using the standard JSON request format used by other protocols.  

This makes it possible to avoid with the use of HTTP routes and to send queries via the HTTP protocol in the same way as for other protocols.

This endpoint is accessible on the route `POST http://<host>:<port>/_query`:

```bash
$ curl -X POST -H  "Content-Type: application/json" "http://localhost:7512/_query" --data '{
  "controller":"server", 
  "action":"now" 
}'
```

The body of the query will be processed by Kuzzle as a standard query.

::: warning
This endpoint does not allow to benefit from the advantages of the cache system integrated to HTTP via URLS.
:::

---

## Other protocols

:::info
Kuzzle's extensible protocol system allows communication in virtually any format. This documentation section describes the format that must be used to pass queries to Kuzzle itself, either directly by users (for instance, using the embedded WebSocket or MQTT protocols), or indirectly, translated by the custom protocol layer.
:::

Queries made to Kuzzle must be encoded using JSON, and have the following format:

```js
{
  // required by all queries
  "controller": "<controller>",
  "action": "<action>",

  // optional, can be added to all queries
  "requestId": "<unique request identifier>",
  "jwt": "<token>",

  // commonly found parameters
  "index": "<index>",
  "collection": "<collection>",
  "body": {
    // query content
  },
  "_id": "<unique ID>"
}
```

### Required parameters:

The following 2 parameters are required by all API requests, as these are directly used by Kuzzle to redirect the query to the correct API action:

- `controller`: accessed Kuzzle API controller
- `action`: API controller action to be executed

Depending on the API action executed, other parameters may be required. Those are detailed in the corresponding API sections.

### Commonly found parameters:

There are 3 parameters that can be provided to all queries, independently to the API action executed:

- `jwt`: user's authentification token, obtained through the [login](/core/2/api/controllers/auth/login) method
- `requestId`: user-defined request identifier. Kuzzle does not guarantee that responses are sent back in the same order than queries are made; use that field to link responses to their query of origin
- `volatile`: user-defined data, without any impact to the query. Use that object to pass information about the query itself to real-time subscribers. Read more [here](/core/2/api/essentials/volatile-data)

Additionally, a few other parameters are very commonly found in API queries:

- `_id`: unique identifier (e.g. document ID, user kuid, memory storage key, ...)
- `body`: query content (e.g. document content, message content, mappings, ...)
- `collection`: collection name
- `index`: index name

### Other parameters

Kuzzle does not enforce a fixed list of parameters. Rather, API actions freely design the parameters list they need, and Kuzzle internal structures reflect that freedom.
This principle is especially useful, as it allows plugins to set their own list of required and optional parameters, without constraint.
