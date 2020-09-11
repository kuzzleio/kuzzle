async function processing () {
  const request = { /* ... */ };
   let result;

  requestPromise(request)
    .then(_result => {
      result = _result;

      createDocument(result);
    });
   return result;
 }
