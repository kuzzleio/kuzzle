---
code: true
type: page
title: Elasticsearch
---

# Elasticsearch

Instantiates an [Elasticsearch client](https://github.com/elastic/elasticsearch-js) with the same configuration as the one provided in the `.kuzzlerc` file.  

This client can be used to send raw Elasticsearch request.  

See [Elasticsearch official documentation](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/7.3/api-reference.html) for more informations.

---

## Constructor

This class constructor takes no argument.

---

### Example

```js
const esClient = new context.constructors.ESClient();

await esClient.info();
```