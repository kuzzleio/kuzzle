/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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
  querystring = require('querystring'),
  RouteHandler = require('./routeHandler'),
  URL = require('url');

/**
 * Defines a new route part
 *
 * @class RoutePart
 */
class RoutePart {
  constructor() {
    this.subparts = {};
    this.parametric = {
      name: '',
      subparts: null
    };

    this.handler = null;
  }

  /**
   * Checks if an url part already exists
   *
   * @param {string} part
   * @returns {boolean}
   */
  exists(part) {
    if (part[0] === ':') {
      return this.parametric.subparts !== null && this.parametric.subparts.handler !== null;
    }

    return this.subparts[part] !== undefined && this.subparts[part].handler !== null;
  }

  /**
   * Gets the next element of an URL part, creating a new
   * tree leaf if necessary
   *
   * @param {string} part
   * @returns {RoutePart}
   */
  getNext(part) {
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
  }

  /**
   * Returns a RouteHandler instance corresponding to the provided URL
   * Returns null if no handler was found
   *
   * @param {object} request - HTTP request formatted by Kuzzle Proxy
   * @return {RouteHandler} registered function handler
   */
  getHandler(request) {
    const
      parsed = URL.parse(request.url, true),
      routeHandler = new RouteHandler(parsed.pathname, parsed.query, request.requestId, request.headers);

    return getHandlerPart(this, parsed.pathname.split('/'), routeHandler);
  }
}

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
    routeHandler.addArgument(routePart.parametric.name, part);
    return getHandlerPart(routePart.parametric.subparts, parts, routeHandler);
  }

  return routeHandler;
}

/**
 * @type {RoutePart}
 */
module.exports = RoutePart;
