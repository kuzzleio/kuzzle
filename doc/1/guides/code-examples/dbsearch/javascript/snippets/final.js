// Require and instantiate kuzzle
const {
  Kuzzle,
  WebSocket
} = require('kuzzle-sdk');

const kuzzle = new Kuzzle(
  // Replace 'kuzzle' with your Kuzzle server hostname. (example: 'localhost')
  new WebSocket('kuzzle')
);

const run = async () => {
  try {
    // Wait a connection to Kuzzle to be established
    await kuzzle.connect();

    // Create a "nyc-open-data" index, a "yellow-taxi" collection
    // and 2 documents with different "licence" property values
    await kuzzle.index.create('nyc-open-data');
    await kuzzle.collection.create('nyc-open-data', 'yellow-taxi');
    await kuzzle.document.create(
      'nyc-open-data',
      'yellow-taxi',
      { licence: 'B' },
      null,
      { refresh: 'wait_for' } // Wait for the document to be indexed by Elasticsearch
    );
    await kuzzle.document.create(
      'nyc-open-data',
      'yellow-taxi',
      { licence: 'C' },
      null,
      { refresh: 'wait_for' } // Wait for the document to be indexed by Elasticsearch
    );

    // Search for documents with "licence" property that include the letter 'B'
    const results = await kuzzle.document.search(
      'nyc-open-data',
      'yellow-taxi',
      {
        query: {
          match: {
            licence: 'B'
          }
        }
      }
    );

    console.log(`There are ${results.hits.length} matching documents.`);
  } catch (error) {
    console.error(error.message);
  } finally {
    // Disconnect from Kuzzle
    kuzzle.disconnect();
  }
};

run();
