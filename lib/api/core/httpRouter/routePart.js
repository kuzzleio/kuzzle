'use strict';

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
 * Returns the handler corresponding to the provided URL
 * Populate the "args" argument with parametric values, if any
 *
 * @param {Array<string>} parts
 * @param {Object} args
 * @return {Function} registered function handler
 */
RoutePart.prototype.getHandler = function routePartGetPart(parts, args) {
  let part;

  do {
    part = parts.shift();
  } while (parts.length > 0 && part.length === 0);

  if (part === undefined) {
    return this.handler;
  }

  if (this.subparts[part]) {
    return this.subparts[part].getHandler(parts, args);
  }

  if (this.parametric.subparts !== null) {
    args[this.parametric.name] = part;
    return this.parametric.subparts.getHandler(parts, args);
  }

  return null;
};

/**
 * @type {RoutePart}
 */
module.exports = RoutePart;
