---
code: false
type: page
title: The bool (Boolean) query
description: learn how to combine filters with elasticsearch
order: 500
---

# The `bool` (Boolean) query

You might want to explore the theory behind this query to understand it more in detail.
If you're interested, you can find a good description on [Wikipedia](https://en.wikipedia.org/wiki/Standard_Boolean_model).

In the boolean compound query, there are 4 occurrence types:

- `must` and `should` are used to filter _AND_ score the documents.
- `filter` and `must_not` are used to filter the documents (whether they match or not) but don't influence the score.

This is what it looks like when we use every occurence type:

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "match": {
          "author": {
            "query": "John Doe",
            "operator": "and"
          }
        }
      },
      "filter": {
        "term": {"tags": "animal" }
      },
      "must_not": {
        "range": {
          "publish_date": {"gte": "1985-01-01", "lte": "2016-01-01" }
        }
      },
      "should": [
        {"term": {"tags": "pet" }},
        {"term": {"tags": "dog" }}
      ]
    }
  }
}'
```

Reply (don't spend too much time reading it, we will explain each occurence type and their effects later):

```json
{
  "took": 6,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 2.4638538,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 2.4638538,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "1",
        "_score": 0.78557956,
        "_source": {
          "author": "John Doe",
          "title": "I love cats",
          "body": "They are so cute",
          "tags": ["pet", "animal", "cat"],
          "status": "pending",
          "publish_date": "2016-08-03"
        }
      }
    ]
  }
}
```

You can find a full description in the [Bool Query documentation](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/query-dsl-bool-query.html).

---

## The `filter` occurrence type

The `filter` occurrence type can be used to filter documents with additional queries without affecting the score.
You can even use a `bool` query in a `filter` occurrence type. We will introduce some ways
to make basic `filter` requests. It will be up to you to choose your favorite.

Each example produces the same result. As you will see, there are different ways to achieve
the same result using the `filter` occurence type.

### Using a logical `AND` operator between fields

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "query_string": {
          "query": "status:published AND publish_date:[2015-01-01 TO *]"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": [
        {"term": {"status": "published" }},
        {"range": {"publish_date": {"gte": "2015-01-01" }}}
      ]
    }
  }
}'
```

Both examples above generate the same result:

```json
{
  "took": 2,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 0.0,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 0.0,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.0,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They are so regal",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

You can notice that the score of both documents is _0_ : this is because we only use the `filter` occurence type
of the `bool` query.

### Using a logical `AND` operator between terms

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "query_string": {
          "query": "author:(john AND doe)"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "match": {
          "author": {
            "query": "john doe",
            "operator": "and"
          }
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": [
        {"match": {"author": "john" }},
        {"match": {"author": "doe" }}
      ]
    }
  }
}'
```

All examples above generate the same result:

```json
{
  "took": 1,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 0.0,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "1",
        "_score": 0.0,
        "_source": {
          "author": "John Doe",
          "title": "I love cats",
          "body": "They are so cute",
          "tags": ["pet", "animal", "cat"],
          "status": "pending",
          "publish_date": "2016-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 0.0,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      }
    ]
  }
}
```

### Using a logical `OR` operator between fields

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "query_string": {
          "query": "title:love OR tags:lion"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "bool": {
          "should": [
            {"match": {"title": "love"}},
            {"match": {"tags": "lion"}}
          ]
        }
      }
    }
  }
}'
```

Both examples above generate the same result:

```json
{
  "took": 2,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 0.0,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "1",
        "_score": 0.0,
        "_source": {
          "author": "John Doe",
          "title": "I love cats",
          "body": "They are so cute",
          "tags": ["pet", "animal", "cat"],
          "status": "pending",
          "publish_date": "2016-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.0,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They are so regal",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

### Using a logical `OR` operator between terms

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "query_string": {
          "query": "status:(published OR pending OR refused)"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "bool": {
          "should": [
            {"term": {"status": "published" }},
            {"term": {"status": "pending" }},
            {"term": {"status": "refused" }}
          ],
          "minimum_should_match": 1
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "match": {
          "status": {
            "query": "published pending refused",
            "analyzer": "standard"
          }
        }
      }
    }
  }
}'
```

The last query is tricky. We specified 3 terms in the query, but as the field `status` is not analyzed,
the query isn't analyzed either. To split the query string into terms, we have to force the use of the `standard` analyzer.
This allows the string `"published pending refused"` to be tokenized into the 3 following terms:
`["published", "pending", "refused"]`.

Reply:

```json
{
  "took": 1,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 4,
    "max_score": 0.0,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "1",
        "_score": 0.0,
        "_source": {
          "author": "John Doe",
          "title": "I love cats",
          "body": "They are so cute",
          "tags": ["pet", "animal", "cat"],
          "status": "pending",
          "publish_date": "2016-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 0.0,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "3",
        "_score": 0.0,
        "_source": {
          "author": "John Smith",
          "title": "I hate fish",
          "body": "They do not bring the ball back",
          "tags": ["pet", "animal", "fish"],
          "status": "pending",
          "publish_date": "2017-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.0,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They are so regal",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

### Using a logical `NOT` operator

In this example we are using a `bool` query in the `filter` occurence type.

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "query_string": {
          "query": "-status:pending"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "filter": {
        "bool": {
          "must_not": {
            "term": {"status": "pending" }
          }
        }
      }
    }
  }
}'
```

Both examples above generate the same result:

```json
{
  "took": 6,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 3,
    "max_score": 0.0,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 0.0,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "4",
        "_score": 0.0,
        "_source": {
          "author": "Jane Doe",
          "title": "I hate cheese cake",
          "body": "I prefer chocolat cake",
          "tags": ["food", "cake"],
          "status": "archived",
          "publish_date": "1985-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.0,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They are so regal",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

---

## The `must_not` occurrence type

The `must_not` occurrence type can be used to specify a query that excludes documents from the result set.
It acts like a logical `NOT`.

### Usage of `must_not` with one query

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must_not": {
        "term": {"status": "pending" }
      }
    }
  }
}'
```

Expected reply:

```json
{
  "took": 3,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 3,
    "max_score": 1.0,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 1.0,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "4",
        "_score": 1.0,
        "_source": {
          "author": "Jane Doe",
          "title": "I hate cheese cake",
          "body": "I prefer chocolat cake",
          "tags": ["food", "cake"],
          "status": "archived",
          "publish_date": "1985-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 1.0,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They are so regal",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

Unlike `filter` that sets the score to 0 if used alone, the `must_not` occurence type sets the score to 1 when used alone.
If you don't want this to happen, you can use the `constant_score` query or include the `bool` with a `must_not` occurence
in a filter (like we did in the previous example).

### Usage of `must_not` with multiple queries

If you need to use more than one query in the `must_not` occurence type, you can replace the query object by
an array of query objects. It will ignore all documents where the field `status` is equal to "pending" or the field
`tags` contains "pet":

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must_not": [
        {"term": {"status": "pending" }},
        {"term": {"tags": "pet" }}
      ]
    }
  }
}'
```

Reply:

```bash
{
  "took": 1,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 1.0,
    "hits": [ {
      "_index": "example",
      "_type": "blogpost",
      "_id": "4",
      "_score": 1.0,
      "_source": {
        "author": "Jane Doe",
        "title": "I hate cheese cake",
        "body": "I prefer chocolat cake",
        "tags": [ "food", "cake" ],
        "status": "archived",
        "publish_date": "1985-08-03"
      }
    }, {
      "_index": "example",
      "_type": "blogpost",
      "_id": "5",
      "_score": 1.0,
      "_source": {
        "author": "Will Smith",
        "title": "I admire lions",
        "body": "They belong to the Savanna",
        "tags": [ "wild animal", "animal", "lion" ],
        "status": "published",
        "publish_date": "2016-08-02"
      }
    } ]
  }
}

```

---

## The `must` occurrence type

The `must` occurrence type can be used used like the `filter` occurence type
with the difference that it will influence the score.
Let's take a look at all the scores we get by replacing the `filter` occurence type in the previous examples with `must`.
The `AND` examples give the same score for all documents. This is due to the small number and small size of the documents we are querying.

### Using a logical `AND` operator between fields

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "query_string": {
          "query": "status:published AND publish_date:[2015-01-01 TO *]"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": [
        {"term": {"status": "published" }},
        {"range": {"publish_date": {"gte": "2015-01-01" }}}
      ]
    }
  }
}'
```

Have the same reply with the same score:

```json
{
  "took": 2,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 1.8117931,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 1.8117931,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 1.8117931,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They belong to the Savanna",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

### Using a logical `AND` operator between terms

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "query_string": {
          "query": "author:(john AND doe)"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "match": {
          "author": {
            "query": "john doe",
            "operator": "and"
          }
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": [
        {"match": {"author": "john" }},
        {"match": {"author": "doe" }}
      ]
    }
  }
}'
```

All examples above generate the same result:

```json
{
  "took": 2,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 1.0811163,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "1",
        "_score": 1.0811163,
        "_source": {
          "author": "John Doe",
          "title": "I love cats",
          "body": "They are so cute",
          "tags": ["pet", "animal", "cat"],
          "status": "pending",
          "publish_date": "2016-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 1.0811163,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      }
    ]
  }
}
```

### Using a logical `OR` operator between fields

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "query_string": {
          "query": "title:love OR tags:lion"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "bool": {
          "should": [
            {"match": {"title": "love"}},
            {"match": {"tags": "lion"}}
          ]
        }
      }
    }
  }
}'
```

Both examples above generate the same result:

```json
{
  "took": 1,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 2,
    "max_score": 0.67751116,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.67751116,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They belong to the Savanna",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "1",
        "_score": 0.33875558,
        "_source": {
          "author": "John Doe",
          "title": "I love cats",
          "body": "They are so cute",
          "tags": ["pet", "animal", "cat"],
          "status": "pending",
          "publish_date": "2016-08-03"
        }
      }
    ]
  }
}
```

### Using a logical `OR` operator between terms

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "query_string": {
          "query": "status:(published OR pending OR refused)"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "bool": {
          "should": [
            {"term": {"status": "published" }},
            {"term": {"status": "pending" }},
            {"term": {"status": "refused" }}
          ],
          "minimum_should_match": 1
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "match": {
          "status": {
            "query": "published pending refused",
            "analyzer": "standard"
          }
        }
      }
    }
  }
}'
```

Reply:

```json
{
  "took": 2,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 4,
    "max_score": 0.22560257,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "1",
        "_score": 0.22560257,
        "_source": {
          "author": "John Doe",
          "title": "I love cats",
          "body": "They are so cute",
          "tags": ["pet", "animal", "cat"],
          "status": "pending",
          "publish_date": "2016-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 0.22560257,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "3",
        "_score": 0.22560257,
        "_source": {
          "author": "John Smith",
          "title": "I hate fish",
          "body": "They do not bring the ball back",
          "tags": ["pet", "animal", "fish"],
          "status": "pending",
          "publish_date": "2017-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.22560257,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They belong to the Savanna",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

### Using a logical `NOT` operator

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "query_string": {
          "query": "-status:pending"
        }
      }
    }
  }
}'
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "must": {
        "bool": {
          "must_not": {
            "term": {"status": "pending" }
          }
        }
      }
    }
  }
}'
```

(the second example is a bit useless as we could use `must_not` directly)

Both examples above generate the same result:

```json
{
  "took": 2,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 3,
    "max_score": 1.0,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 1.0,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "4",
        "_score": 1.0,
        "_source": {
          "author": "Jane Doe",
          "title": "I hate cheese cake",
          "body": "I prefer chocolat cake",
          "tags": ["food", "cake"],
          "status": "archived",
          "publish_date": "1985-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 1.0,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They belong to the Savanna",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```

---

## The `should` occurrence type

The `should` occurrence type is different from the 3 other types as it can be used to specify queries that "SHOULD" match the documents. If used without `filter` or `must` occurence types, at least one query will have to match the document. It could be seen as a logical `OR` operator. Its behavior can be modified by the `minimum_should_match`. It allows us to specify a number or a percentage of queries that have to match in order to select the document. You can see all available value formats of `minimum_should_match` in the [Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/query-dsl-minimum-should-match.html).

### Usage of `minimum_should_match`

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "should": [
        {"term": {"status": "published" }},
        {"term": {"tags": "cake" }},
        {"match": {"body": "regal" }}
      ]
    }
  }
}'
```

We don't use `filter` or `must` occurence types, as a result `minimum_should_match` is equal to 1.

Reply:

```json
{
  "took": 5,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 3,
    "max_score": 0.98358554,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.98358554,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They are so regal",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "4",
        "_score": 0.3945096,
        "_source": {
          "author": "Jane Doe",
          "title": "I hate cheese cake",
          "body": "I prefer chocolat cake",
          "tags": ["food", "cake"],
          "status": "archived",
          "publish_date": "1985-08-03"
        }
      },
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "2",
        "_score": 0.24522427,
        "_source": {
          "author": "John Doe",
          "title": "I like dogs",
          "body": "They are loyal",
          "tags": ["pet", "animal", "dog"],
          "status": "published",
          "publish_date": "2016-08-01"
        }
      }
    ]
  }
}
```

```bash
curl -g -X POST "http://localhost:9200/example/blogpost/_search?pretty" -d '{
  "query": {
    "bool": {
      "should": [
        {"term": {"status": "published" }},
        {"term": {"tags": "cake" }},
        {"match": {"body": "regal" }}
      ],
      "minimum_should_match": 2
    }
  }
}'
```

Reply:

```json
{
  "took": 3,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "hits": {
    "total": 1,
    "max_score": 0.98358554,
    "hits": [
      {
        "_index": "example",
        "_type": "blogpost",
        "_id": "5",
        "_score": 0.98358554,
        "_source": {
          "author": "Will Smith",
          "title": "I admire lions",
          "body": "They are so regal",
          "tags": ["wild animal", "animal", "lion"],
          "status": "published",
          "publish_date": "2016-08-02"
        }
      }
    ]
  }
}
```
