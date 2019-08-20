try {
  await kuzzle.realtime.publish(
    'myindex',
    'mycollection',
    {message: 'hello world'}
  );
  console.log('message published');
} catch (error) {
  console.error(error.message);
}