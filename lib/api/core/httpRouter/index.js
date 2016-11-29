'use strict';

const
  RoutePart = require('./routePart'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Request = require('kuzzle-common-objects').Request,
  HttpResponse = require('../entryPoints/httpResponse');

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
function Router() {
  this.routes = {
    GET: new RoutePart(),
    POST: new RoutePart(),
    PUT: new RoutePart(),
    DELETE: new RoutePart()
  };

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
  let
    routeHandler;

  if (!this.routes[httpRequest.method]) {
    let request = new Request({requestId: httpRequest.requestId}, {}, 'rest');
    return replyWithError(cb, request, new BadRequestError(`Unrecognized HTTP method ${request.method}`));
  }

  routeHandler = this.routes[httpRequest.method].getHandler(httpRequest);

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
 * @param {Object} target
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
  let httpResponse;

  request.setError(error);

  httpResponse = new HttpResponse(request.id, 'application/json', request.status, JSON.stringify(request.response));

  cb(httpResponse);
}

/**
 * @type {Router}
 */
module.exports = Router;
