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

import { JSONObject } from "kuzzle-sdk";
import * as uuid from "uuid";

import { isPlainObject } from "../../util/safeObject";

/**
 * @param protocol - The protocol used (http, websocket, mqtt etc)
 * @param ips - The list of forwarded ips (= X-Forwarded-For http header + the
 *              final ip, i.e. client, proxy1, proxy2, etc.)
 * @param headers - Optional extra key-value object. I.e., for http, will
 *                  receive the request headers
 */
class ClientConnection {
  public readonly id: string;
  public readonly protocol: string;
  public readonly headers: JSONObject;
  public readonly internal: JSONObject;
  public readonly ips: string[];

  constructor(
    protocol: string,
    ips: string[],
    headers: JSONObject | null = null,
    internal: JSONObject | null = null,
  ) {
    this.id = uuid.v4();
    this.protocol = protocol;
    this.headers = {};
    this.internal = {};

    if (!Array.isArray(ips)) {
      throw new TypeError(`Expected ips to be an Array, got ${typeof ips}`);
    }
    this.ips = ips;

    if (isPlainObject(headers)) {
      this.headers = headers;
    }

    if (isPlainObject(internal)) {
      this.internal = internal;
    }

    Object.freeze(this);
  }
}

export = ClientConnection;
