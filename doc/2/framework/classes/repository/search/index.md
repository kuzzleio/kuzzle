---
code: true
type: page
title: search
description: Repository.search method
---

# `search()`

Searches documents.

### Arguments

```js
search(query: JSONObject, options?: JSONObject): Promise<any>;
```

<br/>

| Arguments | Type              | Description                                                                                            |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `query`   | <pre>JSONObject</pre> | Search query, using Elasticsearch [query format](/core/2/guides/main-concepts/querying#basic-querying) |
| `options` | <pre>JSONObject</pre> | Optional arguments                                                                                     |

#### options

The `options` argument accepts the following parameters:

| Options  | Type               | Description                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `from`   | <pre>integer</pre> | Paginates search results by defining the offset from the first result you want to fetch. Usually used with the `size` option                                                                                                                                                                                                                                                                   |
| `scroll` | <pre>string</pre>  | Creates a forward-only result cursor. This option must be set with a [time duration](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units), at the end of which the cursor is destroyed.<br/>If set, a cursor identifier named `scrollId` is returned in the results. This cursor can then be moved forward using the [scroll](#scroll) function |
| `size`   | <pre>integer</pre> | Sets the maximum number of documents returned per result page                                                                                                                                                                                                                                                                                                                                  |

### Return

The `search` function returns a promise resolving to a search result object, with the following properties:

| Field   | Type                | Description                                                                                                                                                       |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hits`  | <pre>any[]</pre> | Found documents. If a `ObjectConstructor` argument was provided to the repository constructor, then each hit is an instance of that class instead of a raw object |
| `total` | <pre>integer</pre>  | Total number of found documents. Can be greater than the number of documents returned in this result set                                                          |
