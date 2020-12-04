---
code: true
type: page
title: scroll
description: Repository.scroll method
---

# `scroll()`

Moves a search cursor forward.

A search cursor is created by a [Repository.search](/core/2/framework/classes/repository/search) function call, with a `scroll` option value provided.

### Arguments

```js
scroll(scrollId: string, ttl?: string): Promise<any>;
```

<br/>

| Arguments  | Type              | Description                                                                                                                                                |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrollId` | <pre>string</pre> | Scroll unique identifier, obtained by the last search/scroll function call (scroll identifiers may change from page to page)                               |
| `ttl`      | <pre>string</pre> | Refreshes the cursor duration, using the [time to live](https://www.elastic.co/guide/en/elasticsearch/reference/7.4/common-options.html#time-units) syntax |

### Return

The `scroll` function returns a promise resolving to a search result object, with the following properties:

| Field   | Type                | Description                                                                                                                                                       |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hits`  | <pre>any[]</pre> | Found documents. If a `ObjectConstructor` argument was provided to the repository constructor, then each hit is an instance of that class instead of a raw object |
| `total` | <pre>integer</pre>  | Total number of found documents. Can be greater than the number of documents returned in this result set                                                          |