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
    this.placeholders = null;

    this.handler = null;
  }

  /**
   * Checks if an url part already exists
   *
   * @param {string} part
   * @returns {boolean}
   */
  exists(part) {
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
      pathname = parsed.pathname || '', // pathname is set to null if empty
      routeHandler = new RouteHandler(pathname, parsed.query, request);

    return getHandlerPart(this, pathname.split('/'), routeHandler);
  }
}

/**
 * Populate the routeHandler argument with parametric values, if any
 *
 * @param {RoutePart} routePart - tree leaf to scan
 * @param {Array<string>} parts
 * @param {RouteHandler} routeHandler - registered function handler
 * @param {Array<string>} placeholders - sorted array to populate the list of parametric values
 * @return {RouteHandler} registered function handler
 */
function getHandlerPart (routePart, parts, routeHandler, placeholders = []) {
  let part;

  do {
    part = parts.shift();
  } while (parts.length > 0 && part.length === 0);

  if (part === undefined) {
    routeHandler.handler = routePart.handler;
    if (routePart.placeholders !== null) {
      for (const i of Object.keys(routePart.placeholders)) {
        routeHandler.addArgument(routePart.placeholders[i], placeholders[i]);
      }
    }
    return routeHandler;
  }

  part = querystring.unescape(part);

  if (routePart.subparts[part]) {
    return getHandlerPart(routePart.subparts[part], parts, routeHandler, placeholders);
  }

  if (routePart.subparts['*']) {
    placeholders.push(part);
    return getHandlerPart(routePart.subparts['*'], parts, routeHandler, placeholders);
  }

  return routeHandler;
}

/**
 * @type {RoutePart}
 */
module.exports = RoutePart;
