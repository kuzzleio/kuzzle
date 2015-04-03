var Kuzzle = require('./api');


// Instantiate and expose a Kuzzle singleton
module.exports = new Kuzzle();

// Expose constructor for convenience/tests
module.exports.Kuzzle = Kuzzle;