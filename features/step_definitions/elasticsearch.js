const
  {
    When,
    Then
  } = require('cucumber'),
  ElasticSearch = require('elasticsearch'),
  kuzzleConfig = require('../support/config');

const elasticsearchClient = new ElasticSearch.Client({
  host: 'localhost:9200'
});

When('I create an index and a collection with ElasticSearch', function (callback) {
  elasticsearchClient.indices.delete({ index: 'es-index' }).then(() => {
    elasticsearchClient.indices.create({ index: 'es-index' })
      .then(() => {
        elasticsearchClient.indices.putMapping({
          index:  'es-index',
          type:   'es-collection',
          body: {
            'es-collection': {
              properties: {
                name: { type: 'text' },
                age:  { type: 'integer' },
              }
            }
          }
        }).then(() => callback());
      }).catch(error => callback(error));
  });
});

When('I create a document directly with ElasticSearch', function (callback) {
  const packet = [
    { index: { _index : 'es-index', _type: 'es-collection' } },
    { name: 'Lau Lau', age: 29 }
  ];

  elasticsearchClient.bulk({ body: packet })
    .then(result => {
      this.documentId = result.items[0].index._id;

      callback();
    }).catch(error => callback(error));
});

When('I update the document with Kuzzle', function (callback) {
  const body = {
    name: 'Lau lau'
  };

  this.api.update(this.documentId, body, 'es-index', 'es-collection')
    .then(aBody => {
      if (aBody.error) {
        callback(aBody.error);
      }
      if (!aBody.result) {
        callback(new Error('No result provided'));
      }
      callback();
    });
});

Then('The _kuzzle_info mapping is correct', function (callback) {
  elasticsearchClient.indices.get({ index: 'index' })
    .then(result => {
      const mapping = result.index.mappings.collection.properties._kuzzle_info.properties;

      Object.entries(kuzzleConfig.services.db.commonMapping).forEach(([field, { type }]) => {
        if (mapping[field].type !== type) {
          callback(new Error(`Mapping mismatch. ${type} expected, got ${mapping[field].type} instead`));
        }
      });
      callback();
    })
    .catch(error => callback(error));
});
