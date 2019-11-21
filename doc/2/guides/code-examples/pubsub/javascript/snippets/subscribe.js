// Create a filter that defines that the 'message' field exists
const filter = {exists: {field: 'message'}};
// Triggered whenever a document matching the filter is submitted to Kuzzle
const callback = notification => {
  console.log(notification.result._source.message);
};
try {
  await kuzzle.realtime.subscribe(
    'myindex',
    'mycollection',
    filter,
    callback
  );
  console.log('subscribe ok');
} catch (error) {
  console.error(error.message);
}