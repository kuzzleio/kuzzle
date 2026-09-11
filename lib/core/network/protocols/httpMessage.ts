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

import type * as uWS from "uWebSockets.js";

import type ClientConnection from "../clientConnection";

class HttpMessage {
  public connection: ClientConnection;
  public ips: string[];
  public query: string;
  public path: string;
  /** @deprecated use "path" instead */
  public url: string; // NOSONAR the field is the deprecation, not a use of one
  public method: string;
  public headers: Record<string, string>;
  public requestId: string;

  private _content: Buffer | null;

  constructor(connection: ClientConnection, request: uWS.HttpRequest) {
    this.connection = connection;
    this._content = null;
    this.ips = connection.ips;
    this.query = request.getQuery();
    this.path = request.getUrl();

    if (this.query && this.query.length > 0) {
      this.path = `${request.getUrl()}?${this.query}`;
    } else {
      this.path = request.getUrl();
    }

    this.url = this.path; // NOSONAR this is what declares the alias

    this.method = request.getMethod().toUpperCase();
    this.headers = {};

    request.forEach((name, value) => (this.headers[name] = value));

    this.requestId = this.headers["x-kuzzle-request-id"] || connection.id;
  }

  set content(value: Buffer | null) {
    if (!value || value.length === 0) {
      this._content = null;
    } else {
      this._content = value;
    }
  }

  get content(): Buffer | null {
    return this._content;
  }
}

export = HttpMessage;
