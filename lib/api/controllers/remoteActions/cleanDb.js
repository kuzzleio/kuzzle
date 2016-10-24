module.exports = function (kuzzle) {
  return () => kuzzle.resetStorage();
};
