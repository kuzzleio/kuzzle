const run = async () => {
  try {
    // Wait for the  connection to Kuzzle to be established
    await kuzzle.connect();
  } catch (error) {
    console.error(error.message);
  } finally {
    // Disconnecting from Kuzzle
    kuzzle.disconnect();
  }
};

run();
