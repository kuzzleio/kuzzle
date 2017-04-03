/*
HTTP Response Mockup to emulate response objects for Passport Authentication
@TODO: Implement a mockup for each HTTP ServerResponse method
(see https://nodejs.org/api/http.html#http_class_http_serverresponse)
*/

/**
 * @class PassportResponse
 */
class PassportResponse {
  constructor() {
    this.headers = {};
    this.statusCode = 200;
    this.onEndListener = null;
  }

  setHeader(field, value) {
    this.headers[field] = value;
  }

  end(statusCode) {
    if (statusCode) {
      this.statusCode = statusCode;
    }
    if(typeof this.onEndListener === 'function') {
      this.onEndListener();
    }
  }

  getHeader(key) {
    return this.headers[key];
  }

  addEndListener(listener) {
    this.onEndListener = listener;
  }
}

module.exports = PassportResponse;
