---
code: true
type: page
title: convertGeopoint | Framework | Core
description: Koncorde.convertGeopoint static method
---

# `convertGeopoint()` (static)

Converts a geopoint, in one of the formats accepted by Koncorde [geospatial clauses](/core/2/api/koncorde-filters-syntax/clauses#geodistance), to a standardized `{ lat, lon }` object.

### Arguments

```ts
static convertGeopoint(point: string | JSONObject): { lat: number, lon: number };
```

<br/>

| Arguments | Type                             | Description |
| --------- | -------------------------------- | ----------- |
| `point`   | <pre>string \| JSONObject</pre> | Geopoint (e.g. `"43.6,3.9"`, `{ lat: 43.6, lon: 3.9 }`, `{ latLon: [43.6, 3.9] }`, a geohash) |

### Return

The `convertGeopoint` function returns a `{ lat, lon }` object, or `null` if the format is not recognized.

### Usage

```js
import { Koncorde } from 'kuzzle';

Koncorde.convertGeopoint('43.6,3.9'); // { lat: 43.6, lon: 3.9 }
```
