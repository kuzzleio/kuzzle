---
code: true
type: page
title: Elasticsearch
---

# Elasticsearch

Instantiates an embedded [Elasticsearch client](https://github.com/elastic/elasticsearch-js) with the same configuration as the one provided in the `.kuzzlerc` file.  

This client can be used to send raw Elasticsearch requests.  

See [Elasticsearch official documentation](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html) for more information.

---

## Constructor

This class constructor takes no argument.

---

### Example

```js
const esClient = new context.constructors.ESClient();

await esClient.info();
```
