# Filtering Syntax

## Overview

For real-time subscription we use a sub language of Elasticsearch DSL, only for [Filters](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-filters.html). Queries are not implemented and will not be.
For a list of available filters in real-time see [Real-time implemented filters](#real-time-filters)

For no-real-time, like search, get, etc, we directly pass information to Elasticsearch. You can use the whole [Elasticsearch DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)

You can also take a look at the internally used [Elasticsearch API](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) for Javascript

<a name="real-time-filters" />
## Real-time implemented filters

* and
* bool
* exists
* geoBoundingBox
* geoDistance
* geoDistanceRange
* missing
* not
* or
* range
* term
* terms
* ids