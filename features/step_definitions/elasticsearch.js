const
  {
    When,
    Then
  } = require('cucumber'),
  ElasticSearch = require('elasticsearch'),
  Bluebird = require('bluebird'),
  kuzzleConfig = require('../support/config');

/**
 * Returns a new elasticsearch client instance
 *
 * @param {object} config - ES client options
 * @returns {object}
 */
function buildClient() {
  // Passed to Elasticsearch's client to make it use
  // Bluebird instead of ES6 promises
  const defer = function defer () {
    let resolve, reject;
    const
      promise = new Bluebird((res, rej) => {
        resolve = res;
        reject = rej;
      });

    return {resolve, reject, promise};
  };

  return new ElasticSearch.Client(Object.assign({ defer }, { host: 'elasticsearch:9200' }));
}

const elasticsearchClient = buildClient();

When('I create an index and a collection with ElasticSearch', function (callback) {
  elasticsearchClient.indices.get({ index: 'es-index' })
    .then(() => this.api.deleteIndex('es-index')) // We use Kuzzle to delete the index to have the cache updated
    .catch(() => null)
    .finally(() => {
      elasticsearchClient.indices.create({ index: 'es-index' })
        .then(() => {
          return elasticsearchClient.indices.putMapping({
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
        })
        .catch(error => callback(error));
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
  elasticsearchClient.indices.getMapping({ index: 'es-index', type: 'es-collection' })
    .then(mappings => {
      const mapping = mappings['es-index'].mappings['es-collection'].properties._kuzzle_info.properties;
      const commonMapping = kuzzleConfig.services.db.commonMapping._kuzzle_info.properties;

      Object.keys(commonMapping).forEach(field => {
        const type = commonMapping[field].type;

        if (mapping[field] && mapping[field].type !== type) {
          callback(new Error(`Mapping mismatch. ${type} expected, got ${mapping[field].type} instead`));
        }
      });
      callback();
    })
    .catch(error => callback(error));
});
