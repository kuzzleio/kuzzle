module.exports = function remoteResetStorage (kuzzle) {
  return () => kuzzle.resetStorage();
};
