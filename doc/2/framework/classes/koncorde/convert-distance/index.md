---
code: true
type: page
title: convertDistance | Framework | Core
description: Koncorde.convertDistance static method
---

# `convertDistance()` (static)

<DeprecatedBadge version="2.14.0" />

Converts a distance string to a number of meters.

### Arguments

```ts
static convertDistance(distance: string): number;
```

<br/>

| Arguments  | Type              | Description |
| ---------- | ----------------- | ----------- |
| `distance` | <pre>string</pre> | Distance with its unit, in the format accepted by the [geoDistance](/core/2/api/koncorde-filters-syntax/clauses#geodistance) clause (e.g. `"1.5km"`, `"500 meters"`) |

### Return

The `convertDistance` function returns the distance in meters.

### Usage

```js
import { Koncorde } from 'kuzzle';

Koncorde.convertDistance('1.5km'); // 1500
```
