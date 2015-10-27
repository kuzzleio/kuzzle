var
  kuzzle = require('../../../../lib');

/**
 * @param {IncomingMessage} request
 * @param {ServerResponse} response
 * @constructor
 */
function HttpConnection (request, response) {
  this.type = 'rest';
  this.request = request;
  this.response = response;
}

/**
 * Extracts the Bearer token from the request headers
 * @returns {string}
 */
HttpConnection.prototype.getUserToken = function () {
  var
    userToken = null,
    r,
    token;

  if (this.request.headers.authorization !== undefined) {
    token = this.request.headers.authorization;
    r = /^Bearer (.*)$/.exec(token);
    if (r !== null && r[1].trim() !== '') {
      userToken = r[1].trim();
    }
  }

  return userToken;
};

module.exports = HttpConnection;
