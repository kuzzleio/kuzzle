'use strict';

const
  querystring = require('querystring'),
  RouteHandler = require('./routeHandler');

/**
 * Defines a new route part
 * @returns {RoutePart}
 * @constructor
 */
function RoutePart() {
  this.subparts = {};
  this.parametric = {
    name: '',
    subparts: null
  };

  this.handler = null;

  return this;
}

/**
 * Checks if an url part already exists
 *
 * @param {string} part
 * @returns {boolean}
 */
RoutePart.prototype.exists = function routePartExists(part) {
  if (part[0] === ':') {
    return this.parametric.subparts !== null && this.parametric.subparts.handler !== null;
  }

  return this.subparts[part] !== undefined && this.subparts[part].handler !== null;
};

/**
 * Gets the next element of an URL part, creating a new
 * tree leaf if necessary
 *
 * @param {string} part
 * @returns {RoutePart}
 */
RoutePart.prototype.getNext = function routePartGetNext(part) {
  if (part[0] === ':') {
    if (this.parametric.subparts === null) {
      this.parametric.name = part.substring(1);
      this.parametric.subparts = new RoutePart();
    }

    return this.parametric.subparts;
  }

  if (!this.subparts[part]) {
    this.subparts[part] = new RoutePart();
  }

  return this.subparts[part];
};

/**
 * Returns a RouteHandler instance corresponding to the provided URL
 * Returns null if no handler was found
 *
 * @param {string} url
 * @return {RouteHandler} registered function handler
 */
RoutePart.prototype.getHandler = function routePartGetPart(url) {
  let routeHandler = new RouteHandler();

  getHandlerPart(this, url.split('/'), routeHandler);

  return routeHandler.handler ? routeHandler : null;
};

/**
 * Populate the routeHandler argument with parametric values, if any
 *
 * @param {RoutePart} routePart - tree leaf to scan
 * @param {Array<string>} parts
 * @param {RouteHandler} routeHandler - registered function handler
 * @return {RouteHandler} registered function handler
 */
function getHandlerPart (routePart, parts, routeHandler) {
  let part;

  do {
    part = parts.shift();
  } while (parts.length > 0 && part.length === 0);

  if (part === undefined) {
    routeHandler.handler = routePart.handler;
    return routeHandler;
  }

  part = querystring.unescape(part);

  if (routePart.subparts[part]) {
    return getHandlerPart(routePart.subparts[part], parts, routeHandler);
  }

  if (routePart.parametric.subparts !== null) {
    routeHandler.args[routePart.parametric.name] = part;
    return getHandlerPart(routePart.parametric.subparts, parts, routeHandler);
  }

  return routeHandler;
}

/**
 * @type {RoutePart}
 */
module.exports = RoutePart;
