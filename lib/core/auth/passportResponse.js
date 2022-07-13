/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

"use strict";

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
    if (typeof this.onEndListener === "function") {
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
