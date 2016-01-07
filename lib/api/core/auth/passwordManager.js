/****
First really simple version of Password Manager
@TODO : improve globally the manager to enable more features
*****/

var
  q = require('q'),
  crypto = require('crypto');

module.exports = function PassportManager (params) {

  this.encryptPassword = function(password) {
    var hashedPassword = crypto.createHmac(params.algorithm, params.secret).update(password).digest(params.digest);
    return q(hashedPassword);
  };

  this.checkPassword = function(password, hash) {
    return this.encryptPassword(password)
    .then(function(value) {
      return q(hash === value);
    });
  };

};