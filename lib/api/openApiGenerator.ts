/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

import _ from 'lodash';

import { Inflector } from '../util/inflector';
import { JSONObject } from '../../index';

const routeUrlMatch = /:([^/]*)/g;

/**
 * Generate basic openApi Controller
 */
function generateController (route: JSONObject, definition: JSONObject) {
  if (route.controller === undefined) {
    return;
  }

  if (! _.some(definition.tags, { name: route.controller })) {
    const capitalizedController = Inflector.pascalCase(route.controller);

    definition.tags.push({
      description: `${capitalizedController} Controller`,
      name: route.controller
    });
  }

  if (route.openapi.tags === undefined) {
    route.openapi.tags = [];
  }

  if (! route.openapi.tags.includes(route.controller)) {
    route.openapi.tags.push(route.controller);
  }
}

/**
 * Generate basic openApi Summary
 */
function generateSummary (route: JSONObject) {
  if (route.openapi.description === undefined) {
    route.openapi.description = `Controller: ${route.controller}.`;
  }

  if (route.openapi.summary === undefined) {
    route.openapi.summary = `Action: ${route.action}.`;
  }
}

/**
 * Generate basic openApi Parameters
 */
function generateParameters (route: JSONObject) {
  if (route.openapi.parameters === undefined) {
    route.openapi.parameters = [];

    let m = routeUrlMatch.exec(route.path);
    while (m !== null) {
      routeUrlMatch.lastIndex++;
      route.openapi.parameters.push({
        in: 'path',
        name: m[1],
        required: true,
        schema: { type: 'string' }
      });

      m = routeUrlMatch.exec(route.path);
    }
  }
  if (route.openapi.parameters.length === 0) {
    route.openapi.parameters = undefined;
  }
}

/**
 * Generate basic openApi Response
 */
function generateResponse (route: JSONObject) {
  if (route.openapi.responses === undefined) {
    route.openapi.responses = {
      '200': {
        description: 'OK'
      }
    };
  }
}

/**
 * Generates JSON OpenApi object
 *
 * @returns {object} openApi object
 */
export function generateOpenApi (routes: JSONObject[], definition: JSONObject): JSONObject {
  for (const route of routes) {
    // Make sure route verbs are lowercase
    if (route.verb !== undefined) {
      route.verb = route.verb.toLowerCase();
    }

    // Set :param notation to {param}
    route.formattedPath = route.path.replace(routeUrlMatch, '{$1}');

    if (definition.paths[route.formattedPath] === undefined) {
      definition.paths[route.formattedPath] = {};
    }

    if (definition.paths[route.formattedPath][route.verb] !== undefined) {
      continue;
    }

    // If custom specification, return as it is
    if (route.openapi) {
      generateController(route, definition);

      definition.paths[route.formattedPath][route.verb] = route.openapi;
      continue;
    }

    if (route.openapi === undefined) {
      route.openapi = {};
    }

    generateController(route, definition);

    generateSummary(route);

    generateParameters(route);

    generateResponse(route);

    definition.paths[route.formattedPath][route.verb] = route.openapi;
  }

  return definition;
}