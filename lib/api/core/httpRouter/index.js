'use strict';

var
  RoutePart = require('./routePart'),
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  url = require('url');

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
 * @param request
 * @param response
 */
Router.prototype.route = function (request, response) {
  let
    parsed = url.parse(request.url, true),
    method = request.method.toUpperCase(),
    handler = this.routes[method].getHandler(parsed.pathname.split('/'), parsed.query);

  if (handler !== null) {
    if (method === 'POST') {
      if (request.headers['content-type'].startsWith('application/json')) {
        let data = '';

        request.on('data', chunk => data += chunk.toString());
        request.on('end', () => {
          try {
            let pojo = JSON.parse(data);

            if (pojo.body) {
              Object.assign(parsed.query, pojo);
            }
            else {
              parsed.query.body = pojo;
            }

            handler(request, response, parsed.query);
          }
          catch (e) {
            sendErrorResponse(response, new BadRequestError('Unable to convert incoming POST data to JSON'));
          }
        });
      }
      else {
        sendErrorResponse(response, new BadRequestError(`Invalid request content-type. Expected "application/json", got: "${request.headers['content-type']}"`));
      }
    }
    else {
      handler(request, response, parsed.query);
    }
  }
  else {
    sendErrorResponse(response, new NotFoundError(`API URL not found: ${parsed.pathname}`));
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
    throw new InternalError(`Unable to attach URL ${url}: URL path already exists`)
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
 * Responds directly with an error if the incoming message does not
 * comply with base expectations
 *
 * @param {Object} response
 * @param {Error} error
 */
function sendErrorResponse(response, error) {
  let message = new ResponseObject({}, error);
  response.writeHead(message.status, {'Content-Type': 'application/json'});
  response.end(JSON.stringify(message.toJson()));
}

/**
 * @type {Router}
 */
module.exports = Router;
