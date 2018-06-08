const
  {
    Then
  } = require('cucumber');

Then(/I (can |can not )?reset the cache "([^"]*)"/, function (can, database, done) {
  if (! can) {
    can = '';
  }

  if (can.indexOf('can not') === -1) {
    this.api.resetCache(database)
      .then(() => done())
      .catch(error => done(error));
  } else {
    this.api.resetCache(database)
      .then(() => done(new Error('Should not be authorized')))
      .catch(error => {
        const status = error.status || error.response.body.status;

        if (status === 403) {
          done();
        } else {
          done(error);
        }
      });
  }
});


Then(/I (can |can not )?reset Kuzzle Data/, function (can, done) {
  if (! can) {
    can = '';
  }

  if (can.indexOf('can not') === -1) {
    this.api.resetKuzzleData()
      .then(() => done())
      .catch(error => done(error));
  } else {
    this.api.resetKuzzleData()
      .then(() => done(new Error('Should not be authorized')))
      .catch(error => {
        const status = error.status || error.response.body.status;

        if (status === 403) {
          done();
        } else {
          done(error);
        }
      });
  }
});

Then(/I (can |can not )?reset Security/, function (can, done) {
  if (! can) {
    can = '';
  }

  if (can.indexOf('can not') === -1) {
    this.api.resetSecurity()
      .then(() => done())
      .catch(error => done(error));
  } else {
    this.api.resetSecurity()
      .then(() => done(new Error('Should not be authorized')))
      .catch(error => {
        const status = error.status || error.response.body.status;

        if (status === 403) {
          done();
        } else {
          done(error);
        }
      });
  }
});

Then(/I (can |can not )?reset Database/, function (can, done) {
  if (! can) {
    can = '';
  }

  if (can.indexOf('can not') === -1) {
    this.api.resetDatabase()
      .then(() => done())
      .catch(error => done(error));
  } else {
    this.api.resetDatabase()
      .then(() => done(new Error('Should not be authorized')))
      .catch(error => {
        const status = error.status || error.response.body.status;

        if (status === 403) {
          done();
        } else {
          done(error);
        }
      });
  }
});
