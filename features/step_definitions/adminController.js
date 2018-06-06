const
  {
    Then
  } = require('cucumber');

Then(/I (can )?reset the cache "([^"]*)"/, function (can, database, done) {
  this.api.resetCache(database)
    .then(() => done())
    .catch(error => done(error));
});


Then(/I (can )?reset Kuzzle Data/, function (can, done) {
  this.api.resetKuzzleData()
    .then(() => done())
    .catch(error => done(error));
});

Then(/I (can )?reset Security/, function (can, done) {
  this.api.resetSecurity()
    .then(() => done())
    .catch(error => done(error));
});

Then(/I (can )?reset Database/, function (can, done) {
  this.api.resetDatabase()
    .then(() => done())
    .catch(error => done(error));
});
