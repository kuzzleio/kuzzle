---
code: false
type: page
title: Kuzzle Response
order: 300
---

# Kuzzle Response

A Kuzzle Response is a standardized result. This format is shared by all API actions, including routes added by controller plugins.

A Kuzzle Response is a JSON object with the following format:

| Property     | Description                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `action`     | Executed controller action                                                                          |
| `collection` | Data collection name, or `null` if no collection was involved                                       |
| `controller` | Executed API controller                                                                             |
| `error`      | [KuzzleError](/core/2/api/essentials/error-handling) object, or `null` if there was no error                |
| `index`      | Data index name, or `null` if no index was involved                                                 |
| `requestId`  | Request unique identifier                                                                           |
| `result`     | Query result, or `null` if an error occured                                                         |
| `status`     | Response status, using [HTTP status codes](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) |
| `volatile`   | Arbitrary data repeated from the initial request                                                    |

## Examples

This is a response from a successful real-time subscription:

```js
{
  "requestId": "32dfbe90-34e1-43c0-a857-25b715b28a1b",
  "status": 200,
  "error": null,
  "controller": "realtime",
  "action": "subscribe",
  "collection": "bar",
  "index": "foo",
  "volatile": null,
  "result":
  {
    "roomId": "75b6e181f963ead45787871776dda3c1",
    "channel": "75b6e181f963ead45787871776dda3c1-7a90af8c8bdaac1b"
  }
}
```

And this is an error, obtained by trying to fetch a non-existing document:

```js
{
  "requestId": "b1e9ed17-1910-4356-b9a2-15e177c949f1",
  "status": 404,
  "error":
  {
    "message": "Not Found",
    "status": 404
  },
  "controller": "document",
  "action": "get",
  "collection": "bar",
  "index": "foo",
  "volatile": null,
  "result": null
}
```
