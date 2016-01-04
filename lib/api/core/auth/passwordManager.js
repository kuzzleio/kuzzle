var
  q = require('q'),
  crypto = require('crypto');

module.exports = function PassportManager () {

  this.secret = 'jbsB8r69PFP39KdLtjVr25Z22';
  this.algo = 'sha1';
  this.digest = 'hex';

  this.encryptPassword = function(password) {
    var hashedPassword = crypto.createHmac(this.algo, this.secret).update(password).digest(this.digest);
    return q(hashedPassword);
  };

  this.checkPassword = function(password, hash) {
    return this.encryptPassword(password)
    .then(function(value) {
      return q(hash === value);
    });
  };

};