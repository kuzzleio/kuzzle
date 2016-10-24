/*
HTTP Response Mockup to emulate response objects for Passport Authentication
@TODO: Implement a mockup for each HTTP ServerResponse method
(see https://nodejs.org/api/http.html#http_class_http_serverresponse)
*/

/**
 * @constructor
 */
function PassportResponse () {

  var onEndListener = null;

  this.headers = {};
  this.statusCode = 200;

  this.setHeader = function passportSetHeader (field, value) {
    this.headers[field] = value;
  };

  this.end = function passportEnd (statusCode) {
    if (statusCode) {
      this.statusCode = statusCode;
    }
    if(typeof onEndListener === 'function') {
      onEndListener();
    }
  };

  this.getHeader = function passportGetHeader (key) {
    return this.headers[key];
  };

  this.addEndListener = function passportAddEndListener (listener) {
    onEndListener = listener;
  };
}

module.exports = PassportResponse;
