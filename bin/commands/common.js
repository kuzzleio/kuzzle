const
  Bluebird = require('bluebird'),
  Kuzzle = require('kuzzle-sdk');

module.exports = {

  /**
   *  Send an action through the API
   *  First log the user if credentials are provided
   *  then send the action to corresponding controller
   *
   *  @param {object} options
   *  @param {string} controller
   *  @param {string} action
   *  @param {object} query
   *  @return {Promise}
   */
  sendAction: (options, args, query = {}) => {
    const config = {
      host: 'localhost',
      port: options.port || 7512
    };

    if (options.parent.username && options.parent.password) {
      config.login = {
        strategy: 'local',
        credentials: {
          username: options.parent.username,
          password: options.parent.password
        }
      };
    }

    return new Bluebird((resolve, reject) => {
      const kuzzle = new Kuzzle(config.host, { port: config.port }, err => {
        if (err) {
          reject(err);
        }

        let deferedPromises = [];

        if (config.login) {
          deferedPromises.push(() => kuzzle.loginPromise(config.login.strategy, config.login.credentials));
        }

        deferedPromises.push(() => kuzzle.queryPromise(args, query));

        deferedPromises.reduce((promise, deferedPromise) => {
          return promise.then(() => deferedPromise());
        }, Bluebird.resolve())
          .then(response => resolve(response))
          .catch(error => reject(error));
      });
    });
  }
};
