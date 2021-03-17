'use strict';

class UWSHttpRequestMock {
  constructor (method = '', url = '', qs = '', headers = {}) {
    this._method = method.toUpperCase();
    this._url = url;
    this._qs = qs;
    this._headers = headers;
  }

  getQuery () {
    return this._qs;
  }

  getMethod () {
    return this._method;
  }

  getUrl () {
    return this._url;
  }

  forEach (cb) {
    for (const [name, value] of Object.entries(this._headers)) {
      cb(name, value);
    }
  }

  getHeader (name) {
    return this._headers[name];
  }
}

module.exports = UWSHttpRequestMock;
