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

const { Request } = require('../../../api/request');
const { KuzzleError } = require('../../../kerror/errors');
const RoutePart = require('./routePart');
const { has } = require('../../../util/safeObject');

const kerror = require('../../../kerror').wrap('network', 'http');
const debug = require('../../../util/debug')('kuzzle:http:router');

/**
 * Attach handler to routes and dispatch a HTTP
 * message to the right handler
 *
 * Handlers will be called with the following arguments:
 *   - request: received HTTP request
 *   - response: HTTP response object
 *   - data: URL query arguments and/or POST data, if any
 *
 * @class Router
 */
class Router {
  constructor() {
    this.defaultHeaders = {
      'Accept-Encoding': 'identity',
      'Access-Control-Allow-Headers': global.kuzzle.config.http.accessControlAllowHeaders,
      'Access-Control-Allow-Methods': global.kuzzle.config.http.accessControlAllowMethods,
      'content-type': 'application/json'
    };

    if (global.kuzzle.config.internal.cookieAuthentication) {
      this.defaultHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    if (global.kuzzle.config.server.protocols.http.allowCompression === true) {
      this.defaultHeaders['Accept-Encoding'] = 'gzip,deflate,identity';
    }

    this.routes = {
      DELETE: new RoutePart(),
      GET: new RoutePart(),
      HEAD: new RoutePart(),
      PATCH: new RoutePart(),
      POST: new RoutePart(),
      PUT: new RoutePart()
    };

    // Add an automatic HEAD route on the '/' url, answering with default headers
    attach('/', (request, cb) => {
      request.setResult({}, 200);
      cb(request);
    }, this.routes.HEAD);
  }

  /**
   * Attach a handler to a GET HTTP route
   *
   * @param {string} path
   * @param {Function} handler
   */
  get(path, handler) {
    attach(path, handler, this.routes.GET);
  }

  /**
   * Attach a handler to a POST HTTP route
   *
   * @param {string} path
   * @param {Function} handler
   */
  post(path, handler) {
    attach(path, handler, this.routes.POST);
  }

  /**
   * Attach a handler to a PUT HTTP route
   *
   * @param {string} path
   * @param {Function} handler
   */
  put(path, handler) {
    attach(path, handler, this.routes.PUT);
  }

  /**
   * Attach a handler to a PATCH HTTP route
   *
   * @param {string} path
   * @param {Function} handler
   */
  patch(path, handler) {
    attach(path, handler, this.routes.PATCH);
  }

  /**
   * Attach a handler to a DELETE HTTP route
   *
   * @param {string} path
   * @param {Function} handler
   */
  delete(path, handler) {
    attach(path, handler, this.routes.DELETE);
  }

  /**
   * Attach a handler to a HEAD HTTP route
   *
   * @param {string} path
   * @param {Function} handler
   */
  head(path, handler) {
    attach(path, handler, this.routes.HEAD);
  }

  /**
   * Route an incoming HTTP message to the right handler
   *
   * @param {HttpMessage} message - Parsed HTTP message
   * @param {function} cb
   */
  route(message, cb) {
    debug('Routing HTTP message: %a', message);

    if (!has(this.routes, message.method)) {
      this.routeUnhandledHttpMethod(message, cb);
      return;
    }

    let routeHandler;

    try {
      routeHandler = this.routes[message.method].getHandler(message);

      // Set Headers if not present
      routeHandler.request.response.setHeaders(this.defaultHeaders, true);

      
      if (message.headers && message.headers.origin) {
        if (global.kuzzle.config.internal.allowAllOrigins) {
          routeHandler.request.response.setHeaders({'Access-Control-Allow-Origin': '*'}, true);
        } else {
          routeHandler.request.response.setHeaders(
            {
              'Access-Control-Allow-Origin': message.headers.origin,
              'Vary': 'Origin',
            },
            true
          );
        }
      }

      if (routeHandler.handler === null) {
        throw kerror.get('url_not_found', routeHandler.url);
      }

      routeHandler.invokeHandler(cb);
    }
    catch (err) {
      let request;
      if (!routeHandler || !routeHandler._request) {
        request = new Request({requestId: message.requestId}, {});
        // Set Headers if not present
        request.response.setHeaders(this.defaultHeaders, true);

        if (message.headers && message.headers.origin) {
          if (global.kuzzle.config.internal.allowAllOrigins) {
            request.response.setHeaders({'Access-Control-Allow-Origin': '*'}, true);
          } else {
            request.response.setHeaders(
              {
                'Access-Control-Allow-Origin': message.headers.origin,
                'Vary': 'Origin',
              },
              true
            );
          }
        }
      }
      else {
        request = routeHandler.request;
      }

      const e = err instanceof KuzzleError
        ? err
        : kerror.getFrom(err, 'unexpected_error', err.message);

      replyWithError(cb, request, e);
    }
  }

  /**
   * Route HTTP messages using an HTTP method that is not handled by Kuzzle's
   * API, such as OPTIONS.
   * @param  {HttpMessage} message
   * @param {function} cb
   */
  routeUnhandledHttpMethod(message, cb) {
    const
      requestContext = global.kuzzle.router.connections.get(message.connection.id),
      request = new Request(
        { requestId: message.requestId },
        requestContext && requestContext.toJSON());

    // Set Headers if not present
    request.response.setHeaders(this.defaultHeaders, true);

    if (message.headers && message.headers.origin) {
      if (global.kuzzle.config.internal.allowAllOrigins) {
        request.response.setHeaders({'Access-Control-Allow-Origin': '*'}, true);
      } else {
        request.response.setHeaders(
          {
            'Access-Control-Allow-Origin': message.headers.origin,
            'Vary': 'Origin',
          },
          true
        );
      }
    }

    if (message.method === 'OPTIONS') {
      request.input.headers = message.headers;
      request.setResult({}, 200);

      global.kuzzle.pipe('http:options', request, (error, result) => {
        if (error) {
          replyWithError(cb, request, error);
        }
        else {
          cb(result);
        }
      });

      return;
    }

    replyWithError(
      cb,
      request,
      kerror.get('unsupported_verb', message.method));
  }
}

/**
 * Attach a handler to an path and stores it to the target object
 *
 * @param {string} path
 * @param {Function} handler
 * @param {RoutePart} target
 */
function attach(path, handler, target) {
  const sanitized = path[path.length - 1] === '/' ? path.slice(0, -1) : path;

  if (!attachParts(sanitized.split('/'), handler, target)) {
    throw kerror.get('duplicate_url', sanitized);
  }
}

/**
 *
 * @param {Array<string>} parts
 * @param {Function} routeHandler
 * @param {RoutePart} target
 * @param {Array<string>} placeholders
 * @returns {Boolean} If false, failed to attach because of a duplicate
 */
function attachParts(parts, handler, target, placeholders = []) {
  let part;

  do {
    part = parts.shift();
  } while (parts.length > 0 && part.length === 0);

  if (part && part[0] === ':') {
    placeholders.push(part.substring(1));
    part = '*';
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
 *
 * @param {function} cb
 * @param {Request} request
 * @param {Error} error
 */
function replyWithError(cb, request, error) {
  request.setError(error);

  cb(request);
}

/**
 * @type {Router}
 */
module.exports = Router;
