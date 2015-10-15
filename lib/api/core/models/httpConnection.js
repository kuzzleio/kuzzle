var
  q = require('q'),
  jwt = require('jsonwebtoken'),
  UserRepository = require('./security/userrepository');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function HttpConnection (kuzzle) {
  this.kuzzle = kuzzle;
  this.userRepository = new UserRepository(kuzzle);

  this.user = null;
}

HttpConnection.prototype.init = function (request, response) {
  var
    deferred = q.defer(),
    r,
    token;

  this.type = 'rest';
  this.response = response;

  if (request.headers.authorization) {
    token = request.headers.authorization;
    r = /^Bearer (.*)$/.exec(token);
    if (r !== null && r[1].trim() != '') {
      this.userToken = r[1].trim();
    }
  }

  if (this.userToken !== null) {
    this.userRepository.loadFromToken(this.userToken)
      .then(function (user) {
        this.user = user;

        deferred.resolve(this);
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });
  }
  else {
    deferred.resolve(this);
  }

  return deferred.promise;
};

module.exports = HttpConnection;
