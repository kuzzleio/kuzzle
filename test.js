const Kuzzle = require('kuzzle-sdk');
const Bluebird = require('bluebird')
const kuzzle = new Kuzzle('localhost', { port: 7512 }, (err, res) => {

  if (err) {
    console.log(err);
    process.exit(1);
  }
  let promises = []
  if (process.argv[2] === 'ok') {
    promises.push(() => kuzzle.loginPromise('local', { username: 'admin', password: 'password' }));
  }

  const args = {
    controller: 'auth',
    action: 'getCurrentUser'
  };

  promises.push(() => kuzzle.queryPromise(args, {}));

  promises.reduce((promise, item) => {
    return promise
      .then((result) => {
        return item()
      })
  }, Bluebird.resolve())
  .then(resp => console.log(resp))
});
