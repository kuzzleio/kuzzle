try {
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

  console.log('New documents successfully created!');
} catch (error) {
  console.error(error);
}
