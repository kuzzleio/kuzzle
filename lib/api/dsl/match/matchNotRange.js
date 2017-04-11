const
  matchRange = require('./matchRange');

module.exports = (storage, testTables, document) => matchRange(storage, testTables, document, true);

