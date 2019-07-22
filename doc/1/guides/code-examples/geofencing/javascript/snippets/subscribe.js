const filter = {exists: {field: 'message'}};
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