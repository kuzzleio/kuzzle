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

import { Request } from "../../../api/request";
import { wrap } from "../../../kerror";
import { KuzzleError } from "../../../kerror/errors";
import createDebug from "../../../util/debug";
import { has } from "../../../util/safeObject";
import type HttpMessage from "../protocols/httpMessage";
import RoutePart from "./routePart";
import { RouteCallback, RouteHandlerFunction } from "./routeTypes";

const kerror = wrap("network", "http");
const debug = createDebug("kuzzle:http:router");

/**
 * Attach handler to routes and dispatch a HTTP message to the right handler
 *
 * Handlers will be called with the following arguments:
 *   - request: received HTTP request
 *   - response: HTTP response object
 *   - data: URL query arguments and/or POST data, if any
 */
class Router {
  public defaultHeaders: Record<string, string>;
  public routes: Record<string, RoutePart>;

  constructor() {
    this.defaultHeaders = {
      "Accept-Encoding": "identity",
      "Access-Control-Allow-Headers":
        global.kuzzle.config.http.accessControlAllowHeaders,
      "Access-Control-Allow-Methods":
        global.kuzzle.config.http.accessControlAllowMethods,
      "content-type": "application/json",
    };

    if (global.kuzzle.config.http.cookieAuthentication) {
      this.defaultHeaders["Access-Control-Allow-Credentials"] = "true";
    }

    if (global.kuzzle.config.server.protocols.http.allowCompression === true) {
      this.defaultHeaders["Accept-Encoding"] = "gzip,deflate,identity";
    }

    this.routes = {
      DELETE: new RoutePart(),
      GET: new RoutePart(),
      HEAD: new RoutePart(),
      PATCH: new RoutePart(),
      POST: new RoutePart(),
      PUT: new RoutePart(),
    };

    // Add an automatic HEAD route on the '/' url, answering with default headers
    attach(
      "/",
      (request, cb) => {
        request.setResult({}, { status: 200 });
        cb(request);
      },
      this.routes.HEAD,
    );
  }

  /**
   * Attach a handler to a GET HTTP route
   */
  get(path: string, handler: RouteHandlerFunction): void {
    attach(path, handler, this.routes.GET);
  }

  /**
   * Attach a handler to a POST HTTP route
   */
  post(path: string, handler: RouteHandlerFunction): void {
    attach(path, handler, this.routes.POST);
  }

  /**
   * Attach a handler to a PUT HTTP route
   */
  put(path: string, handler: RouteHandlerFunction): void {
    attach(path, handler, this.routes.PUT);
  }

  /**
   * Attach a handler to a PATCH HTTP route
   */
  patch(path: string, handler: RouteHandlerFunction): void {
    attach(path, handler, this.routes.PATCH);
  }

  /**
   * Attach a handler to a DELETE HTTP route
   */
  delete(path: string, handler: RouteHandlerFunction): void {
    attach(path, handler, this.routes.DELETE);
  }

  /**
   * Attach a handler to a HEAD HTTP route
   */
  head(path: string, handler: RouteHandlerFunction): void {
    attach(path, handler, this.routes.HEAD);
  }

  /**
   * Route an incoming HTTP message to the right handler
   *
   * @param message - Parsed HTTP message
   */
  route(message: HttpMessage, cb: RouteCallback): void {
    debug("Routing HTTP message: %a", message);

    if (!has(this.routes, message.method)) {
      this.routeUnhandledHttpMethod(message, cb);
      return;
    }

    let routeHandler;

    try {
      routeHandler = this.routes[message.method].getHandler(message);

      // Set Headers if not present
      routeHandler.request.response.setHeaders(this.defaultHeaders, true);

      applyACAOHeader(message, routeHandler.request);

      if (routeHandler.handler === null) {
        throw kerror.get("url_not_found", routeHandler.url);
      }

      routeHandler.invokeHandler(cb);
    } catch (err) {
      let request;

      if (!routeHandler || !routeHandler._request) {
        request = new Request({ requestId: message.requestId }, {});
        // Set Headers if not present
        request.response.setHeaders(this.defaultHeaders, true);

        applyACAOHeader(message, request);
      } else {
        request = routeHandler.request;
      }

      const e =
        err instanceof KuzzleError
          ? err
          : kerror.getFrom(err, "unexpected_error", (err as Error).message);

      replyWithError(cb, request, e);
    }
  }

  /**
   * Route HTTP messages using an HTTP method that is not handled by Kuzzle's
   * API, such as OPTIONS.
   */
  routeUnhandledHttpMethod(message: HttpMessage, cb: RouteCallback): void {
    const requestContext = global.kuzzle.router.connections.get(
        message.connection.id,
      ),
      request = new Request(
        { requestId: message.requestId },
        requestContext && requestContext.toJSON(),
      );

    // Set Headers if not present
    request.response.setHeaders(this.defaultHeaders, true);

    applyACAOHeader(message, request);

    if (message.method === "OPTIONS") {
      request.input.headers = message.headers;
      request.setResult({}, { status: 200 });

      global.kuzzle.pipe(
        "http:options",
        request,
        (error: Error | null, result: Request) => {
          if (error) {
            replyWithError(cb, request, error);
          } else {
            cb(result);
          }
        },
      );

      return;
    }

    replyWithError(cb, request, kerror.get("unsupported_verb", message.method));
  }
}

/**
 * Set the Header Access-Control-Allow-Origin based on the kuzzle configuration
 * and request origin
 */
function applyACAOHeader(message: HttpMessage, request: Request): void {
  if (message.headers && message.headers.origin) {
    request.response.setHeaders(
      {
        "Access-Control-Allow-Origin": message.headers.origin,
        Vary: "Origin",
      },
      true,
    );
  }
}

/**
 * Attach a handler to a path and stores it to the target object
 */
function attach(
  path: string,
  handler: RouteHandlerFunction,
  target: RoutePart,
): void {
  const sanitized = path.at(-1) === "/" ? path.slice(0, -1) : path;

  if (!attachParts(sanitized.split("/"), handler, target)) {
    throw kerror.get("duplicate_url", sanitized);
  }
}

/**
 * @returns If false, failed to attach because of a duplicate
 */
function attachParts(
  parts: string[],
  handler: RouteHandlerFunction,
  target: RoutePart,
  placeholders: string[] = [],
): boolean {
  let part: string | undefined;

  do {
    part = parts.shift();
  } while (parts.length > 0 && part.length === 0);

  if (part && part[0] === ":") {
    placeholders.push(part.substring(1));
    part = "*";
  }

  const next = target.getNext(part);

  if (parts.length > 0) {
    return attachParts(parts, handler, next, placeholders);
  }

  if (target.exists(part)) {
    return false;
  }

  next.handler = handler;
  next.placeholders = placeholders;

  return true;
}

/**
 * Reply to a callback function with an HTTP error
 */
function replyWithError(
  cb: RouteCallback,
  request: Request,
  error: Error,
): void {
  request.setError(error);

  cb(request);
}

export = Router;
