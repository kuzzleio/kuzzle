const
  {
    Then
  } = require('cucumber');

Then(/I can reset the cache "([^"]*)"/, function (database) {
  return this.api.resetCache(database);
});


Then('I can reset Kuzzle Data', function () {
  return this.api.resetKuzzleData();
});

Then('I can reset Security', function () {
  return this.api.resetSecurity();
});
