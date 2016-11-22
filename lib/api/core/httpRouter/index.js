'use strict';

const
  RoutePart = require('./routePart'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
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
 * Route an incoming HTTP request to the right handler
 *
 * @param {object} request - HTTP request formatted by Kuzzle Proxy
 * @param {function} cb
 */
Router.prototype.route = function route (request, cb) {
  let
    routeHandler;

  if (!this.routes[request.method]) {
    let requestObject = new RequestObject({requestId: request.requestId}, {}, 'rest');
    return replyWithError(cb, requestObject, new BadRequestError(`Unrecognized HTTP method ${request.method}`));
  }

  routeHandler = this.routes[request.method].getHandler(request);

  if (routeHandler.handler !== null) {
    if (request.content.length > 0) {
      if (!request.headers['content-type'] || request.headers['content-type'].startsWith('application/json')) {
        let encoding = CharsetRegex.exec(request.headers['content-type']);

        if (encoding !== null && encoding[1].toLowerCase() !== 'utf-8') {
          return replyWithError(cb, routeHandler.getRequestObject(), new BadRequestError(`Invalid request charset. Expected "utf-8", got: "${encoding[1].toLowerCase()}"`));
        }

        try {
          routeHandler.addContent(request.content);
          routeHandler.invokeHandler(cb);
        }
        catch (e) {
          replyWithError(cb, routeHandler.getRequestObject(), new BadRequestError('Unable to convert HTTP body to JSON'));
        }
      }
      else {
        replyWithError(cb, routeHandler.getRequestObject(), new BadRequestError(`Invalid request content-type. Expected "application/json", got: "${request.headers['content-type']}"`));
      }
    }
    else {
      routeHandler.invokeHandler(cb);
    }
  }
  else {
    replyWithError(cb, routeHandler.getRequestObject(), new NotFoundError(`API URL not found: ${routeHandler.url}`));
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
 * @param {object} requestObject
 * @param {Error} error
 */
function replyWithError(cb, requestObject, error) {
  let
    response = JSON.stringify((new ResponseObject(requestObject, error)).toJson()),
    httpResponse = new HttpResponse(requestObject.requestId, 'application/json', error.status, response);

  cb(httpResponse);
}

/**
 * @type {Router}
 */
module.exports = Router;
