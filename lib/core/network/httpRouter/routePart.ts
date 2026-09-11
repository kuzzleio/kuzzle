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

import { JSONObject } from "kuzzle-sdk";

import { has } from "../../../util/safeObject";
import type HttpMessage from "../protocols/httpMessage";
import RouteHandler from "./routeHandler";
import { RouteHandlerFunction } from "./routeTypes";

/**
 * Defines a new route part
 */
class RoutePart {
  public subparts: Record<string, RoutePart>;
  public placeholders: string[] | null;
  public handler: RouteHandlerFunction | null;

  constructor() {
    this.subparts = {};
    this.placeholders = null;

    this.handler = null;
  }

  /**
   * Checks if an url part already exists
   */
  exists(part: string): boolean {
    return (
      this.subparts[part] !== undefined && this.subparts[part].handler !== null
    );
  }

  /**
   * Gets the next element of an URL part, creating a new tree leaf if necessary
   */
  getNext(part: string): RoutePart {
    if (!has(this.subparts, part)) {
      this.subparts[part] = new RoutePart();
    }

    return this.subparts[part];
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
    const parsed = URL.parse(message.url, true);
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
  let part: string | undefined;

  do {
    part = parts.shift();
  } while (parts.length > 0 && part.length === 0);

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

  if (has(routePart.subparts, part)) {
    return getHandlerPart(
      routePart.subparts[part],
      parts,
      routeHandler,
      placeholders,
    );
  }

  if (routePart.subparts["*"]) {
    placeholders.push(part);

    return getHandlerPart(
      routePart.subparts["*"],
      parts,
      routeHandler,
      placeholders,
    );
  }

  return routeHandler;
}

export = RoutePart;
