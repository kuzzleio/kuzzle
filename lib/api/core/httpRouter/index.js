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
  RoutePart = require('./routePart'),
  Request = require('kuzzle-common-objects').Request,
  {
    KuzzleError,
    InternalError: KuzzleInternalError,
    BadRequestError,
    NotFoundError
  } = require('kuzzle-common-objects').errors;

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
      'Access-Control-Allow-Origin': kuzzle.config.http.accessControlAllowOrigin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Content-Encoding, Content-Length, X-Kuzzle-Volatile'
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
   * Route an incoming HTTP httpRequest to the right handler
   *
   * @param {object} httpRequest - HTTP httpRequest formatted by Kuzzle Proxy
   * @param {function} cb
   */
  route(httpRequest, cb) {
    let request;

    if (!this.routes[httpRequest.method]) {
      // the http protocol uses the requestId as connection id
      const requestContext = this.kuzzle.router.connections[httpRequest.requestId];
      request = new Request({requestId: httpRequest.requestId}, requestContext && requestContext.toJSON());
      request.response.setHeaders(this.defaultHeaders);

      if (httpRequest.method.toUpperCase() === 'OPTIONS') {
        request.input.headers = httpRequest.headers;
        request.setResult({}, 200);

        this.kuzzle.pluginsManager.trigger('http:options', request)
          .then(result => {
            cb(result);
            return null;
          })
          .catch(error => replyWithError(cb, request, error));

        return;
      }

      replyWithError(cb, request, new BadRequestError(`Unrecognized HTTP method ${httpRequest.method}`));
      return;
    }

    httpRequest.url = httpRequest.url.replace(LeadingSlashRegex, '');

    try {
      const routeHandler = this.routes[httpRequest.method].getHandler(httpRequest);

      request = routeHandler.getRequest();
      request.response.setHeaders(this.defaultHeaders);

      if (routeHandler.handler === null) {
        throw new NotFoundError(`API URL not found: ${routeHandler.url}`);
      }

      if (httpRequest.content.length <= 0) {
        routeHandler.invokeHandler(cb);
        return;
      }

      if (httpRequest.headers['content-type']
      && !httpRequest.headers['content-type'].startsWith('application/json')) {
        throw new BadRequestError(`Invalid request content-type. Expected "application/json", got: "${httpRequest.headers['content-type']}"`);
      }

      {
        const encoding = CharsetRegex.exec(httpRequest.headers['content-type']);

        if (encoding !== null && encoding[1].toLowerCase() !== 'utf-8') {
          throw new BadRequestError(`Invalid request charset. Expected "utf-8", got: "${encoding[1].toLowerCase()}"`);
        }
      }

      routeHandler.addContent(httpRequest.content);
      routeHandler.invokeHandler(cb);

      return null;
    }
    catch (err) {
      if (request === undefined) {
        request = new Request({requestId: httpRequest.requestId}, {}, 'rest');
        request.response.setHeaders(this.defaultHeaders);
      }

      const e = (err instanceof KuzzleError) && err || new KuzzleInternalError(err);
      replyWithError(cb, request, e);
      return;
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
  }
  catch (e) {
    throw new KuzzleInternalError(`Unable to attach URL ${cleanedUrl}: URL path already exists`);
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
    throw new Error('part already exists');
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
