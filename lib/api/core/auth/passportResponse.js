/*
HTTP Response Mockup to emulate response objects for Passport Authentication
@TODO: Implement a mockup for each HTTP ServerResponse method
(see https://nodejs.org/api/http.html#http_class_http_serverresponse)
*/

/**
 * @param {Promise} deferred
 * @constructor
 */
function PassportResponse (deferred) {

  this.headers = {};
  this.statusCode = 200;

  this.setHeader = function(field, value) {
    this.headers[field] = value;
  };

  this.end = function(statusCode) {
    if (statusCode) {
      this.statusCode = statusCode;
    }
    deferred.resolve(this);
  };

  this.getHeader = function(key) {
    return this.headers[key];
  };
}

module.exports = PassportResponse;
