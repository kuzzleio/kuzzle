/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const
  errorsManager = require('../../../config/error-codes/throw').wrap('network', 'http_router'),
  debug = require('../../../kuzzleDebug')('kuzzle:http:router'),
  RoutePart = require('./routePart'),
  { Request, errors: { KuzzleError } } = require('kuzzle-common-objects');

const
  LeadingSlashRegex = /\/+$/,
  CharsetRegex = /charset=([\w-]+)/i;

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
  constructor(kuzzle) {
    this.kuzzle = kuzzle;

    this.defaultHeaders = {
      'content-type': 'application/json',
      'Accept-Encoding': 'identity',
      'Access-Control-Allow-Origin': kuzzle.config.http.accessControlAllowOrigin,
      'Access-Control-Allow-Methods': kuzzle.config.http.accessControlAllowMethods,
      'Access-Control-Allow-Headers': kuzzle.config.http.accessControlAllowHeaders
    };

    if (this.kuzzle.config.server.protocols.http.allowCompression === true) {
      this.defaultHeaders['Accept-Encoding'] = 'gzip,deflate,identity';
    }

    this.routes = {
      GET: new RoutePart(),
      POST: new RoutePart(),
      PUT: new RoutePart(),
      PATCH: new RoutePart(),
      DELETE: new RoutePart(),
      HEAD: new RoutePart()
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
   * @param {string} url
   * @param {Function} handler
   */
  get(url, handler) {
    attach(url, handler, this.routes.GET);
  }

  /**
   * Attach a handler to a POST HTTP route
   *
   * @param {string} url
   * @param {Function} handler
   */
  post(url, handler) {
    attach(url, handler, this.routes.POST);
  }

  /**
   * Attach a handler to a PUT HTTP route
   *
   * @param {string} url
   * @param {Function} handler
   */
  put(url, handler) {
    attach(url, handler, this.routes.PUT);
  }

  /**
   * Attach a handler to a PATCH HTTP route
   *
   * @param {string} url
   * @param {Function} handler
   */
  patch(url, handler) {
    attach(url, handler, this.routes.PATCH);
  }

  /**
   * Attach a handler to a DELETE HTTP route
   *
   * @param {string} url
   * @param {Function} handler
   */
  delete(url, handler) {
    attach(url, handler, this.routes.DELETE);
  }

  /**
   * Attach a handler to a HEAD HTTP route
   *
   * @param {string} url
   * @param {Function} handler
   */
  head(url, handler) {
    attach(url, handler, this.routes.HEAD);
  }

  /**
   * Route an incoming HTTP message to the right handler
   *
   * @param {HttpMessage} message - Parsed HTTP message
   * @param {function} cb
   */
  route(message, cb) {
    debug('Routing HTTP message: %a', message);

    if (!this.routes[message.method]) {
      return this.routeUnhandledHttpMethod(message, cb);
    }

    message.url = message.url.replace(LeadingSlashRegex, '');

    let routeHandler;

    try {
      routeHandler = this.routes[message.method].getHandler(message);

      routeHandler.request.response.setHeaders(this.defaultHeaders);

      if (routeHandler.handler === null) {
        errorsManager.throw('api_url_not_found', routeHandler.url);
      }

      if (!message.isEmpty()) {
        this.validateMessage(message);
      }

      routeHandler.invokeHandler(cb);
    } catch (err) {
      let request;
      if (!routeHandler || !routeHandler._request) {
        request = new Request({requestId: message.requestId}, {});
        request.response.setHeaders(this.defaultHeaders);
      }
      else {
        request = routeHandler.request;
      }

      const e = err instanceof KuzzleError
        ? err
        : errorsManager.getError('request_error', err);

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
      requestContext = this.kuzzle.router.connections.get(message.connection.id),
      request = new Request(
        { requestId: message.requestId },
        requestContext && requestContext.toJSON());

    request.response.setHeaders(this.defaultHeaders);

    if (message.method === 'OPTIONS') {
      request.input.headers = message.headers;
      request.setResult({}, 200);

      this.kuzzle.pipe('http:options', request)
        .then(result => {
          cb(result);
          return null;
        })
        .catch(error => replyWithError(cb, request, error));

      return;
    }

    replyWithError(
      cb,
      request,
      errorsManager.getError('unrecognized_http_method', message.method));
  }

  /**
   * Checks that an incoming HTTP message is well-formed
   * @param  {HttpMessage} message
   */
  validateMessage (message) {
    const contentType = message.headers['content-type'];

    if (contentType && !contentType.startsWith('application/json')) {
      errorsManager.throw('invalid_request_content_type', contentType);
    }

    const encoding = CharsetRegex.exec(contentType);

    if (encoding !== null && encoding[1].toLowerCase() !== 'utf-8') {
      errorsManager.throw('invalid_request_charset', encoding[1].toLowerCase());
    }
  }
}

/**
 * Attach a handler to an URL and stores it to the target object
 *
 * @param {string} url
 * @param {Function} handler
 * @param {RoutePart} target
 */
function attach(url, handler, target) {
  const cleanedUrl = url.replace(LeadingSlashRegex, '');

  try {
    attachParts(cleanedUrl.split('/'), handler, target);
  } catch (e) {
    errorsManager.throw('unable_to_attach_url', cleanedUrl);
  }
}

/**
 *
 * @param {Array<string>} parts
 * @param {Function} routeHandler
 * @param {RoutePart} target
 * @param {Array<string>} placeholders
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
    errorsManager.throw('part_already_exists');
  }

  next.handler = handler;
  next.placeholders = placeholders;
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
