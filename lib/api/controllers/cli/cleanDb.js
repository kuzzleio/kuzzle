module.exports = function cliResetStorage (kuzzle) {
  return () => kuzzle.resetStorage();
};
