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

import { Request, RequestContext } from "../../api/request";
import * as kerror from "../../kerror";
import kuzzleStateEnum from "../../kuzzle/kuzzleStateEnum";
import HttpRouter from "./httpRouter";
import { RouteCallback } from "./httpRouter/routeTypes";

/** The HttpRouter methods a route's verb may resolve to */
type HttpVerb = "get" | "post" | "put" | "patch" | "delete" | "head";

class Router {
  public connections: Map<string, RequestContext>;
  public http: HttpRouter;

  private readonly logger = global.kuzzle.log.child("core:network:router");

  constructor() {
    this.connections = new Map();
    this.http = new HttpRouter();
  }

  /**
   * Declares a new connection attached to a network protocol.
   */
  newConnection(requestContext: RequestContext): void {
    if (!requestContext.connection.id || !requestContext.connection.protocol) {
      this.logger.error(
        kerror.get(
          "protocol",
          "runtime",
          "invalid_connection",
          JSON.stringify(requestContext),
        ),
      );
    } else {
      this.connections.set(requestContext.connection.id, requestContext);
      global.kuzzle.statistics.newConnection(requestContext);
    }
  }

  /**
   * Removes a connection from the connection pool.
   */
  removeConnection(requestContext: RequestContext): void {
    const connId = requestContext.connection.id;

    if (!connId || !requestContext.connection.protocol) {
      this.logger.error(
        kerror.get(
          "protocol",
          "runtime",
          "invalid_connection",
          JSON.stringify(requestContext),
        ),
      );
      return;
    }

    if (!this.connections.has(connId)) {
      this.logger.error(
        kerror.get(
          "protocol",
          "runtime",
          "unknown_connection",
          JSON.stringify(connId),
        ),
      );
      return;
    }

    this.connections.delete(connId);

    global.kuzzle.statistics.dropConnection(requestContext);
  }

  /**
   * Check that the provided connection id executing a request is still alive
   */
  isConnectionAlive(requestContext: RequestContext): boolean {
    // Check only defined connection identifiers (some protocols might
    // not have one)
    return (
      requestContext.connection.id === null ||
      this.connections.has(requestContext.connection.id)
    );
  }

  /**
   * Initializes the HTTP routes for the Kuzzle HTTP API.
   */
  init(): void {
    // Register API and plugin routes
    const routes = [
      ...global.kuzzle.config.http.routes,
      ...global.kuzzle.pluginsManager.routes,
    ];

    this.http.post("_query", (request, cb) => {
      // We need to build a new request from the body
      // and we also need to keep the original request context
      const requestPayload = request.input.body;

      if (request.input.jwt && requestPayload.jwt === undefined) {
        requestPayload.jwt = request.input.jwt;
      }

      const apiRequest = new Request(
        requestPayload,
        request.serialize().options,
      );

      this._executeFromHttp("post", apiRequest, cb);
    });

    this.http.get("_healthcheck", (request, cb) => {
      request.response.configure({
        status: 200,
      });

      /**
       * By avoiding using the funnel, we avoid the request to be logged
       * This is useful for ochestrators healthchecks
       */
      cb(request);
    });

    this.http.get("_ready", (request, cb) => {
      let status = 200;

      if (
        global.kuzzle.state !== kuzzleStateEnum.RUNNING ||
        global.kuzzle.funnel.overloaded
      ) {
        status = 503;
      }

      request.response.configure({
        status,
      });

      /**
       * By avoiding using the funnel, we avoid the request to be logged
       * This is useful for ochestrators healthchecks
       */
      cb(request);
    });

    for (const route of routes) {
      // the route table's verbs are the HttpRouter method names, uppercased
      const verb = route.verb.toLowerCase() as HttpVerb;

      this.http[verb](route.path, (request, cb) => {
        request.input.controller = route.controller;
        request.input.action = route.action;

        if (route.deprecated) {
          const {
            deprecated: { since, message },
          } = route;
          request.addDeprecation(since, message);
        }

        this._executeFromHttp(route.verb, request, cb);
      });
    }

    /**
     * Returns inner metrics from the router
     */
    global.kuzzle.onAsk("core:network:router:metrics", () => this.metrics());
  }

  /**
   * Returns the metrics of the router
   */
  metrics(): JSONObject {
    const connectionsByProtocol: Record<string, number> = {};

    for (const connection of this.connections.values()) {
      const protocol = connection.connection.protocol.toLowerCase();

      if (protocol === "internal") {
        continue;
      }

      connectionsByProtocol[protocol] ??= 0;
      connectionsByProtocol[protocol]++;
    }

    return {
      connections: connectionsByProtocol,
    };
  }

  /**
   * Transmit HTTP requests to the funnel controller and forward its response
   * back to the client
   *
   * @param request - includes URL and POST query data
   * @param cb - callback to invoke with the result
   */
  _executeFromHttp(verb: string, request: Request, cb: RouteCallback): void {
    global.kuzzle.pipe(
      `http:${verb}`,
      request,
      (error: Error | null, mutatedRequest: Request) => {
        if (error) {
          request.setError(error);
          cb(request);
          return;
        }

        global.kuzzle.funnel.execute(
          mutatedRequest,
          (err: Error | null, result: Request) => {
            const _res = result || request;

            if (err && !_res.error) {
              _res.setError(err);
            }

            // no sanitisation here: `_res` is a KuzzleRequest, and the stack
            // is stripped by the protocols, on the serialized response
            cb(_res);
          },
        );
      },
    );
  }
}

export = Router;
