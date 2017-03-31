'use strict';

const
  RoutePart = require('./routePart'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Request = require('kuzzle-common-objects').Request;

const CharsetRegex = /charset=([\w-]+)/i;

/**
 * Attach handler to routes and dispatch a HTTP
 * message to the right handler
 *
 * Handlers will be called with the following arguments:
 *   - request: received HTTP request
 *   - response: HTTP response object
 *   - data: URL query arguments and/or POST data, if any
 *
 * @constructor
 */
function Router(kuzzle) {
  this.kuzzle = kuzzle;

  this.defaultHeaders = {
    'content-type': 'application/json',
    'Access-Control-Allow-Origin': kuzzle.config.http.accessControlAllowOrigin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With'
  };

  this.routes = {
    GET: new RoutePart(),
    POST: new RoutePart(),
    PUT: new RoutePart(),
    DELETE: new RoutePart(),
    HEAD: new RoutePart()
  };

  // Add an automatic HEAD route on the '/' url, answering with default headers
  attach('/', (request, cb) => {
    Object.assign(request.input.args, this.defaultHeaders);
    request.setResult({}, 200);
    cb(request.response);
  }, this.routes.HEAD);

  return this;
}

/**
 * Attach a handler to a GET HTTP route
 *
 * @param {string} url
 * @param {Function} handler
 */
Router.prototype.get = function routerGet(url, handler) {
  attach(url, handler, this.routes.GET);
};

/**
 * Attach a handler to a POST HTTP route
 *
 * @param {string} url
 * @param {Function} handler
 */
Router.prototype.post = function routerGet(url, handler) {
  attach(url, handler, this.routes.POST);
};

/**
 * Attach a handler to a PUT HTTP route
 *
 * @param {string} url
 * @param {Function} handler
 */
Router.prototype.put = function routerGet(url, handler) {
  attach(url, handler, this.routes.PUT);
};

/**
 * Attach a handler to a DELETE HTTP route
 *
 * @param {string} url
 * @param {Function} handler
 */
Router.prototype.delete = function routerGet(url, handler) {
  attach(url, handler, this.routes.DELETE);
};

/**
 * Route an incoming HTTP httpRequest to the right handler
 *
 * @param {object} httpRequest - HTTP httpRequest formatted by Kuzzle Proxy
 * @param {function} cb
 */
Router.prototype.route = function route (httpRequest, cb) {
  let routeHandler;

  if (!this.routes[httpRequest.method]) {
    let request = new Request({requestId: httpRequest.requestId}, {}, 'rest');
    request.response.setHeaders(this.defaultHeaders);

    if (httpRequest.method.toUpperCase() === 'OPTIONS') {
      Object.assign(request.input.args, httpRequest.headers);
      request.setResult({}, 200);

      return this.kuzzle.pluginsManager.trigger('http:options', request)
        .then(result => {
          cb(result.response);
          return null;
        })
        .catch(error => replyWithError(cb, request, error));
    }

    return replyWithError(cb, request, new BadRequestError(`Unrecognized HTTP method ${httpRequest.method}`));
  }

  routeHandler = this.routes[httpRequest.method].getHandler(httpRequest);
  routeHandler.getRequest().response.setHeaders(this.defaultHeaders);

  if (routeHandler.handler !== null) {
    if (httpRequest.content.length > 0) {
      if (!httpRequest.headers['content-type'] || httpRequest.headers['content-type'].startsWith('application/json')) {
        let encoding = CharsetRegex.exec(httpRequest.headers['content-type']);

        if (encoding !== null && encoding[1].toLowerCase() !== 'utf-8') {
          return replyWithError(cb, routeHandler.getRequest(), new BadRequestError(`Invalid request charset. Expected "utf-8", got: "${encoding[1].toLowerCase()}"`));
        }

        try {
          routeHandler.addContent(httpRequest.content);
          routeHandler.invokeHandler(cb);
        }
        catch (e) {
          replyWithError(cb, routeHandler.getRequest(), new BadRequestError('Unable to convert HTTP body to JSON'));
        }
      }
      else {
        replyWithError(cb, routeHandler.getRequest(), new BadRequestError(`Invalid request content-type. Expected "application/json", got: "${httpRequest.headers['content-type']}"`));
      }
    }
    else {
      routeHandler.invokeHandler(cb);
    }
  }
  else {
    replyWithError(cb, routeHandler.getRequest(), new NotFoundError(`API URL not found: ${routeHandler.url}`));
  }
};

/**
 * Attach a handler to an URL and stores it to the target object
 *
 * @param {string} url
 * @param {Function} handler
 * @param {object} target
 */
function attach(url, handler, target) {
  try {
    attachParts(url.split('/'), handler, target);
  }
  catch (e) {
    throw new InternalError(`Unable to attach URL ${url}: URL path already exists`);
  }
}

function attachParts(parts, handler, target) {
  let part;

  do {
    part = parts.shift();
  } while (parts.length > 0 && part.length === 0);

  if (parts.length > 0) {
    attachParts(parts, handler, target.getNext(part));
  }
  else {
    if (target.exists(part)) {
      throw new Error('part already exists');
    }

    target.getNext(part).handler = handler;
  }
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

  cb(request.response);
}

/**
 * @type {Router}
 */
module.exports = Router;
