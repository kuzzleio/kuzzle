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

'use strict';

const _ = require('lodash');

const routeUrlMatch = /:([^/]*)/g;

/**
 * Generates a JSON swagger object
 *
 * @param {Array.<Object>} routes
 * @returns {object} swagger object
 */
module.exports = function generateSwagger (routes) {
  /* eslint-disable sort-keys */
  const swagger = {
    openapi: '3.0.1',
    info: {
      title: 'Kuzzle API',
      description: 'The Kuzzle HTTP API',
      contact: {
        name: 'Kuzzle team',
        url: 'http://kuzzle.io',
        email: 'hello@kuzzle.io'
      },
      license: {
        name: 'Apache 2',
        url: 'http://opensource.org/licenses/apache2.0'
      },
      version: require('../../package').version
    },
    externalDocs: {
      description: 'Kuzzle API Documentation',
      url: 'https://docs.kuzzle.io/core/2/api/'
    },
    servers: [
      {
        url: 'https://{baseUrl}:{port}',
        description: 'Kuzzle Base Url',
        variables: {
          baseUrl: {
            default: 'localhost'
          },
          port: {
            default: '7512'
          }
        }

      }
    ],
    tags: [],
    paths: {},
  };
  /* eslint-enable sort-keys */

  routes.forEach(route => {
    // Set :param notation to {param}
    route.url_ = route.url.replace(routeUrlMatch, '{$1}');

    if (swagger.paths[route.url_] === undefined) {
      swagger.paths[route.url_] = {};
    }

    if (swagger.paths[route.url_][route.verb] !== undefined) {
      return;
    }

    if (route.info === undefined) {
      route.info = {};
    }
    if (route.controller !== undefined) {
      if (!_.some(swagger.tags, {name: route.controller})) {
        const capitalizedController = route.controller.charAt(0).toUpperCase() + route.controller.slice(1);
        swagger.tags.push({description: `${capitalizedController} Controller`, name: route.controller});
      }
      if (route.info.tags === undefined) {
        route.info.tags = [];
      }
      if (!route.info.tags.includes(route.controller)) {
        route.info.tags.push(route.controller);
      }
    }

    if (route.info.description === undefined) {
      route.info.description = `Controller: ${route.controller}.`;
    }
    if (route.info.summary === undefined) {
      route.info.summary = `Action: ${route.action}.`;
    }
    if (route.info.parameters === undefined) {
      route.info.parameters = [];

      let m = routeUrlMatch.exec(route.url);
      while (m !== null) {
        routeUrlMatch.lastIndex++;
        route.info.parameters.push({
          in: 'path',
          name: m[1],
          required: true,
          schema: {type: 'string'}
        });

        m = routeUrlMatch.exec(route.url);
      }
    }

    if (route.info.parameters.length === 0) {
      route.info.parameters = undefined;
    }

    if (route.info.responses === undefined) {
      route.info.responses = {
        '200': {
          description: 'OK'
        }
      };
    }

    swagger.paths[route.url_][route.verb] = route.info;
  });

  return swagger;
};
