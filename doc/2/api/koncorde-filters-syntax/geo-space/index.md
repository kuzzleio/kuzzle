---
code: false
type: page
title: Geo-Space
description: List of accepted formats for geolocation values
order: 300
---

# Geo-Space

Geofencing in Koncorde consists in **defining forms in the geo-space using geopoints and geodistances** within clauses like [geoBoundingBox](/core/2/api/koncorde-filters-syntax/clauses#geoboundingbox), [geoDistance](/core/2/api/koncorde-filters-syntax/clauses#geodistance), [geoDistanceRange](/core/2/api/koncorde-filters-syntax/clauses#geodistancerange) and [geoPolygon](/core/2/api/koncorde-filters-syntax/clauses#geopolygon). 

In this section, you will find a detailed explanation about how to specify geopoints and geodistances.

## Geopoints

A geopoint holds the **coordinates of a geographical point expressed as latitude and longitude**.

In Koncorde, geopoints can be defined in multiple ways. All of the following examples are equivalent, and point to the same coordinates with latitude `43.6021299` and longitude `3.8989713`:

- `[ 43.6021299, 3.8989713 ]`
- `"43.6021299, 3.8989713"`
- `"spfb09x0ud5s"` ([geohash](https://en.wikipedia.org/wiki/Geohash))
- `{ lat: 43.6021299, lon: 3.8989713 }`

Alternative 1:

- `{ latLon: [ 43.6021299, 3.8989713 ] }`
- `{ latLon: { lat: 43.6021299, lon: 3.8989713 } }`
- `{ latLon: "43.6021299, 3.8989713" }`
- `{ latLon: "spfb09x0ud5s"}` ([geohash](https://en.wikipedia.org/wiki/Geohash))

Alternative 2:

- `{ lat_lon: [ 43.6021299, 3.8989713 ] }`
- `{ lat_lon: { lat: 43.6021299, lon: 3.8989713 } }`
- `{ lat_lon: "43.6021299, 3.8989713" }`
- `{ lat_lon: "spfb09x0ud5s"}` ([geohash](https://en.wikipedia.org/wiki/Geohash))

## Geodistances

Distances used in geofencing filters such as [geoDistance](/core/2/api/koncorde-filters-syntax/clauses#geodistance) or [geoDistanceRange](/core/2/api/koncorde-filters-syntax/clauses#geodistancerange) can be expressed in various ways.

Accepted units:

- `m`, `meter`, `meters`
- `ft`, `feet`, `feets`
- `in`, `inch`, `inches`
- `yd`, `yard`, `yards`
- `mi`, `mile`, `miles`

**Note:** if no unit is specified, then Koncorde will express the geodistance in meters.

Accepted unit modifiers: from `yocto-` (10e-21) to `yotta-` (10e24), and their corresponding short forms (e.g. `kilometers` or `km`)

Accepted formats: `<int (spaces accepted)>[.|,]<decimals><spaces><unit>`.

### Example

The following distances are all equivalent and valid input parameters:

```
1000
1000 m
1km
3280.839895013123 ft
3280.839895013123FT
39370.078740157485 inches
39370.078740157485 inch
39370.078740157485 in
1 093,6132983377079 yd
0.6213727366498067 miles
```
