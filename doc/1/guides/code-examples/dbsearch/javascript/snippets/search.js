try {
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
  console.error(error);
}
