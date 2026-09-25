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

import type { JSONObject } from "../../../types/JSONObject";

import { Request } from "../../../api/request";
import { wrap } from "../../../kerror";
import type HttpMessage from "../protocols/httpMessage";
import type { RouteHandlerFunction } from "./routeTypes";

const kerror = wrap("network", "http");

/**
 * Object returned by routePart.getHandler(), containing the information
 * gathered about a requested route and the corresponding handler to invoke
 *
 * @throws {BadRequestError} If x-kuzzle-volatile HTTP header can not be parsed
 *                           in JSON format
 */
class RouteHandler {
  public handler: RouteHandlerFunction | null = null;
  public url: string;
  public data: JSONObject;
  public connection: { connection: JSONObject };

  public _request: Request | null = null;

  constructor(url: string, query: JSONObject, message: HttpMessage) {
    this.url = url;

    this.data = {
      body: message.content,
      requestId: message.requestId,
      ...query,
    };

    this.connection = {
      connection: {
        headers: message.headers,
        id: message.connection.id,
        ips: message.ips,
        path: message.path,
        protocol: "http",
        // the request context's own deprecated alias of "path"
        url: message.path,
        verb: message.method,
      },
    };

    // `Object.entries` rather than `Object.keys` + three indexed reads: the
    // value comes back with the key, so there is nothing to look up twice and
    // nothing for `noUncheckedIndexedAccess` to object to.
    for (const [name, value] of Object.entries(message.headers)) {
      if (
        name.toLowerCase() === "authorization" &&
        value.toLowerCase().startsWith("bearer ")
      ) {
        this.data.jwt = value.substring("Bearer ".length);
      } else if (name.toLowerCase() === "x-kuzzle-volatile") {
        try {
          this.data.volatile = JSON.parse(value);
        } catch (e) {
          // A malformed header is whatever JSON.parse threw, which is a
          // SyntaxError in practice but is not typed as one.
          const error = e instanceof Error ? e : new Error(String(e));

          throw kerror.getFrom(error, "volatile_parse_failed", error.message);
        }
      }
    }
  }

  get request(): Request {
    this._request ??= new Request(this.data, this.connection);

    return this._request;
  }

  /**
   * Add a parametric argument to the request object
   *
   * `value` is optional because its only caller pairs a route's placeholder
   * names with the values collected during the descent, and a name with no
   * value has always been written through as `undefined` rather than skipped.
   */
  addArgument(name: string, value: string | undefined): void {
    this.data[name] = value;
  }
}

export = RouteHandler;
