---
code: false
type: page
title: Data Insertion
description: learn how to index data with elasticsearch
order: 200
---

# Data Insertion

We use the `?pretty` keyword to get human-readable outputs from our requests.

---

## Creating a Mapping

We will provide Elasticsearch with a mapping (RDBM: schema) for the data we want to index.
Here we create a new document `type` (RDBM: table) called `blogpost` with 6 fields (RDBM: columns).

:::warning
The mapping is not mandatory, but if you don't define it before pushing data to Elasticsearch,
Elasticsearch will infer the mapping for each field based on its content.
Once defined, the field type cannot be changed.
:::

```bash
curl -g -X PUT "http://localhost:9200/example/?pretty" -d '{
  "settings" : {
    "index" : {
      "number_of_shards" : 1
    }
  },
  "mappings": {
    "blogpost": {
      "properties": {
        "author": {
          "type": "text",
          "analyzer": "standard"
        },
        "title": {
          "type": "text",
          "analyzer": "english"
        },
        "body": {
          "type": "text",
          "analyzer": "english"
        },
        "tags": {
          "type": "keyword"
        },
        "status": {
          "type": "keyword"
        },
        "publish_date": {
          "type": "date",
          "format": "yyyy-MM-dd||epoch_millis"
        }
      }
    }
  }
}'
```

Reply:

```json
{
  "acknowledged": true
}
```

---

## Creating a Document

```bash
curl -g -X PUT "http://localhost:9200/example/blogpost/1?pretty" -d '{
  "author": "John Doe",
  "title": "I love cats",
  "body": "They are so cute",
  "tags": [ "pet", "animal", "cat" ],
  "status": "pending",
  "publish_date": "2016-08-03"
}'

curl -g -X PUT "http://localhost:9200/example/blogpost/2?pretty" -d '{
  "author": "John Doe",
  "title": "I like dogs",
  "body": "They are loyal",
  "tags": [ "pet", "animal", "dog" ],
  "status": "published",
  "publish_date": "2016-08-01"
}'

curl -g -X PUT "http://localhost:9200/example/blogpost/3?pretty" -d '{
  "author": "John Smith",
  "title": "I hate fish",
  "body": "They do not bring the ball back",
  "tags": [ "pet", "animal", "fish" ],
  "status": "pending",
  "publish_date": "2017-08-03"
}'

curl -g -X PUT "http://localhost:9200/example/blogpost/4?pretty" -d '{
  "author": "Jane Doe",
  "title": "I hate cheese cake",
  "body": "I prefer chocolat cake",
  "tags": [ "food", "cake" ],
  "status": "archived",
  "publish_date": "1985-08-03"
}'

curl -g -X PUT "http://localhost:9200/example/blogpost/5?pretty" -d '{
  "author": "Will Smith",
  "title": "I admire lions",
  "body": "They are so regal",
  "tags": [ "wild animal", "animal", "lion" ],
  "status": "published",
  "publish_date": "2016-08-02"
}'

```

Replies:

```json
{
  "_index": "example",
  "_type": "blogpost",
  "_id": "1",
  "_version": 1,
  "_shards": {
    "total": 2,
    "successful": 1,
    "failed": 0
  },
  "created": true
}
```

```json
{
  "_index": "example",
  "_type": "blogpost",
  "_id": "2",
  "_version": 1,
  "_shards": {
    "total": 2,
    "successful": 1,
    "failed": 0
  },
  "created": true
}
```

```json
{
  "_index": "example",
  "_type": "blogpost",
  "_id": "3",
  "_version": 1,
  "_shards": {
    "total": 2,
    "successful": 1,
    "failed": 0
  },
  "created": true
}
```

```json
{
  "_index": "example",
  "_type": "blogpost",
  "_id": "4",
  "_version": 1,
  "_shards": {
    "total": 2,
    "successful": 1,
    "failed": 0
  },
  "created": true
}
```

```json
{
  "_index": "example",
  "_type": "blogpost",
  "_id": "5",
  "_version": 1,
  "_shards": {
    "total": 2,
    "successful": 1,
    "failed": 0
  },
  "created": true
}
```

---

## The 'id'

The number (1 to 5) at the end of the request url specifies the document id \(RDBM: primary key\).

If you do not specify it, Elasticsearch will automatically generate an ID and assign it to the document.  
Even if the ID is actually a String, you can use numbers for convenience.
For the sake of this example, we explicitly defined the ID of each document (take a look at the last chunk of the URLs).

---

## The 'body'

The body of the request must contain the content of the document you want to create.

In the requests outlined above, the structure of the document matches our mapping.
As a result, Elasticsearch will analyze and index our document as specified.

---

## The Structure

In the requests outlined above, we insert an array into a field that is defined as a string (`tags`). This is one of the features of Elasticsearch: any field can be an array of the defined type.

For example, the `tags` field is defined as a string, but we chose to use it as an array of strings (and this is totally fine).  
Another feature of Elasticsearch is that you can nest a field to build complex documents.

While this feature is not addressed in this cookbook, you can find more information in the
[Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/5.x/object.html).
