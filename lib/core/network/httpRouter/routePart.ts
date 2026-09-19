/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import * as querystring from "node:querystring";
import * as URL from "node:url";

import type { JSONObject } from "kuzzle-sdk";

import type HttpMessage from "../protocols/httpMessage";
import RouteHandler from "./routeHandler";
import type { RouteHandlerFunction } from "./routeTypes";

/**
 * Defines a new route part
 */
class RoutePart {
  public subparts: Record<string, RoutePart>;
  public placeholders: string[] | null;
  public handler: RouteHandlerFunction | null;

  constructor() {
    // Null-prototype: URL parts are attacker-controlled, and `{}` answers
    // `subparts["toString"]` with a function. That is why every read below used
    // to go through `has()` first; with no prototype to inherit from, a single
    // indexed read is both safe and honest — it is `RoutePart | undefined`, and
    // nothing has to be taken on trust between the check and the use.
    this.subparts = Object.create(null);
    this.placeholders = null;

    this.handler = null;
  }

  /**
   * Checks if an url part already exists
   */
  exists(part: string): boolean {
    const subpart = this.subparts[part];

    return subpart !== undefined && subpart.handler !== null;
  }

  /**
   * Gets the next element of an URL part, creating a new tree leaf if necessary
   */
  getNext(part: string): RoutePart {
    let subpart = this.subparts[part];

    if (subpart === undefined) {
      subpart = new RoutePart();
      this.subparts[part] = subpart;
    }

    return subpart;
  }

  /**
   * Returns a RouteHandler instance corresponding to the provided URL
   * Returns null if no handler was found
   */
  getHandler(message: HttpMessage): RouteHandler {
    // Do not use WHATWG API yet, stick with the legacy (and deprecated) URL
    // There are two issues:
    //   - Heavy performance impact: https://github.com/nodejs/node/issues/30334
    //   - Double slash bug: https://github.com/nodejs/node/issues/30776
    const parsed = URL.parse(message.path, true);
    let pathname = parsed.pathname || ""; // pathname is set to null if empty

    if (pathname.at(-1) === "/") {
      pathname = pathname.slice(0, -1);
    }

    const routeHandler = new RouteHandler(
      pathname,
      parsed.query as JSONObject,
      message,
    );

    return getHandlerPart(this, pathname.split("/"), routeHandler);
  }
}

/**
 * Populate the routeHandler argument with parametric values, if any
 *
 * @param routePart - tree leaf to scan
 * @param routeHandler - registered function handler
 * @param placeholders - sorted array to populate the list of parametric values
 */
function getHandlerPart(
  routePart: RoutePart,
  parts: string[],
  routeHandler: RouteHandler,
  placeholders: string[] = [],
): RouteHandler {
  let part = parts.shift();

  while (part !== undefined && part.length === 0 && parts.length > 0) {
    part = parts.shift();
  }

  if (part === undefined) {
    routeHandler.handler = routePart.handler;

    if (routePart.placeholders !== null) {
      for (const [i, name] of routePart.placeholders.entries()) {
        routeHandler.addArgument(name, placeholders[i]);
      }
    }

    return routeHandler;
  }

  part = querystring.unescape(part);

  const subpart = routePart.subparts[part];

  if (subpart !== undefined) {
    return getHandlerPart(subpart, parts, routeHandler, placeholders);
  }

  const wildcard = routePart.subparts["*"];

  if (wildcard !== undefined) {
    placeholders.push(part);

    return getHandlerPart(wildcard, parts, routeHandler, placeholders);
  }

  return routeHandler;
}

export = RoutePart;
