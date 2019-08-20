---
code: true
type: page
title: Koncorde
---

# Koncorde

<SinceBadge version="1.6.0" />

Instantiates a new [Koncorde](/core/2/guides/cookbooks/realtime-api) engine.

---

## Constructor

This class constructor takes no argument.

---

## exists



Returns a boolean telling whether filters exist for an index-collection pair.

### Arguments

```js
exists(index, collection);
```

<br/>

| Arguments    | Type              | Description     |
| ------------ | ----------------- | --------------- |
| `index`      | <pre>string</pre> | Index name      |
| `collection` | <pre>string</pre> | Collection name |

### Return

The `exists` function returns a boolean telling whether at least one filter exists in the provided index-collection pair.

---

## getFilterIds



Retrieves the list of filter identifiers registered on an index-collection pair.

### Arguments

```js
getFilterIds(index, collection);
```

<br/>

| Arguments    | Type              | Description     |
| ------------ | ----------------- | --------------- |
| `index`      | <pre>string</pre> | Index name      |
| `collection` | <pre>string</pre> | Collection name |

### Return

The `getFilterIds` function returns an array of strings, containing the exhaustive list of filter identifiers registered in the provided index-collection pair.

---

## normalize

<SinceBadge version="1.1.0" />

Normalizes filters without storing them.

The result can be directly used with the [store](#store) function.

### Arguments

```js
normalize(index, collection, filters);
```

<br/>

| Arguments    | Type              | Description                                     |
| ------------ | ----------------- | ----------------------------------------------- |
| `index`      | <pre>string</pre> | Index name                                      |
| `collection` | <pre>string</pre> | Collection name                                 |
| `filters`    | <pre>object</pre> | Filters, in [Koncorde](/core/2/guides/cookbooks/realtime-api) format |

### Return

The `normalize` function returns a promise resolving to an object with the following properties:

| Field        | Type                | Description                                          |
| ------------ | ------------------- | ---------------------------------------------------- |
| `collection` | <pre>string</pre>   | Collection name                                      |
| `id`         | <pre>string</pre>   | The filter unique identifier                         |
| `index`      | <pre>string</pre>   | Index name                                           |
| `normalized` | <pre>object[]</pre> | Normalized/optimized version of the supplied filters |

---

## register



Registers a filter to this Koncorde instance.

This method is equivalent to executing [normalize](#normalize) + [store](#store).

### Arguments

```js
register(index, collection, filters);
```

<br/>

| Arguments    | Type              | Description                                     |
| ------------ | ----------------- | ----------------------------------------------- |
| `index`      | <pre>string</pre> | Index name                                      |
| `collection` | <pre>string</pre> | Collection name                                 |
| `filters`    | <pre>object</pre> | Filters, in [Koncorde](/core/2/guides/cookbooks/realtime-api) format |

### Return

The `register` functions returns a promise, resolving to an object with the following attributes:

| Field  | Type              | Description                                                                                                |
| ------ | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`   | <pre>string</pre> | The filter unique identifier                                                                               |
| `diff` | <pre>object</pre> | If the filter doesn't already exist in the engine, contains the normalized version of the provided filters |

---

## remove



Removes a filter.

### Arguments

```js
remove(filterId);
```

<br/>

| Arguments  | Type              | Description                                                                                                     |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `filterId` | <pre>string</pre> | Filter unique identifier, obtained either with [normalize](#normalize) or [register](#register) |

### Return

The `remove` function returns a promise, resolved once the filter has been completely removed from Koncorde.

---

## store

<SinceBadge version="1.1.0" />

Stores filters, normalized with the [normalize](#normalize)) function.

### Arguments

```js
store(normalized);
```

<br/>

| Arguments    | Type              | Description        |
| ------------ | ----------------- | ------------------ |
| `normalized` | <pre>object</pre> | Normalized filters |

### Return

The `store` function returns an object with the following attributes:

| Field  | Type              | Description                                                                                 |
| ------ | ----------------- | ------------------------------------------------------------------------------------------- |
| `id`   | <pre>string</pre> | The filter unique identifier                                                                |
| `diff` | <pre>object</pre> | If the filter didn't already exist, contains the normalized version of the provided filters |

---

## test



Tests data and returns the matching filter identifiers.

### Arguments

```js
test(index, collection, data, [documentId]);
```

<br/>

| Arguments    | Type              | Description                |
| ------------ | ----------------- | -------------------------- |
| `index`      | <pre>string</pre> | Index name                 |
| `collection` | <pre>string</pre> | Collection name            |
| `data`       | <pre>object</pre> | Data to test               |
| `documentId` | <pre>string</pre> | Document unique identifier |

### Return

The `test` function returns an array of strings, which is the exhaustive list of matching filter identifiers.

---

## validate



Validates the provided filters without storing them.

### Arguments

```js
validate(filters);
```

<br/>

| Arguments | Type              | Description                                     |
| --------- | ----------------- | ----------------------------------------------- |
| `filters` | <pre>object</pre> | Filters, in [Koncorde](/core/2/guides/cookbooks/realtime-api) format |

### Return

The `validate` function returns a promise, which is resolved if the filters are well-formed, and rejected otherwise.
