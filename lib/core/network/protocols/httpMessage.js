/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * @class HttpMessage
 */
class HttpMessage {
  /**
   * @param {ClientConnection} connection
   * @param {uWS.HttpRequest} request
   */
  constructor(connection, request) {
    this.connection = connection;
    this._content = null;
    this.ips = connection.ips;
    this.requestId = connection.id;
    this.query = request.getQuery();
    this.path = request.getUrl();

    if (this.query.length > 0) {
      this.path = `${request.getUrl()}?${this.query}`;
    }
    else {
      this.path = request.getUrl();
    }

    // @deprecated use "path" instead
    this.url = this.path;

    this.method = request.getMethod().toUpperCase();
    this.headers = {};

    request.forEach((name, value) => (this.headers[name] = value));
  }

  set content (value) {
    if (!value || value.length === 0) {
      this._content = null;
    }
    else {
      this._content = value;
    }
  }

  get content () {
    return this._content;
  }
}

module.exports = HttpMessage;
