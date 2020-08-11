try {
  // Connects to Kuzzle
  await kuzzle.connect();

  // Create a 'playground' index
  await kuzzle.index.create('playground');

  // Create a collection named 'mycollection' in playground index
  await kuzzle.collection.create(
    'playground',
    'mycollection'
  );

  console.log('playground/mycollection ready');
} catch (error) {
  console.error(error.message);
}