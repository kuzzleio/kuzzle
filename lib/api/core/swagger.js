/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

const _ = require('lodash');

const routeUrlMatch = /:([^/]*)/g;

/**
 * Generates JSON swagger object
 *
 * @param {Kuzzle} kuzzle
 * @return {object} swagger object
 */
module.exports = function generateSwagger (kuzzle) {
  const routes = [];

  kuzzle.config.http.routes.forEach(_route => routes.push(_.assign({}, _route)));

  routes.push({verb: 'get', url: '/_serverInfo', controller: 'server', action: 'info'});

  kuzzle.pluginsManager.routes.forEach(_route => {
    const route = _.assign({}, _route);
    route.url = '/_plugin' + route.url;
    routes.push(route);
  });

  const swagger = {
    basePath: '/',
    consumes: [
      'application/json'
    ],
    host: 'sandbox.kuzzle.io:7512',
    info: {
      contact: {
        email: 'hello@kuzzle.io',
        name: 'Kuzzle team',
        url: 'http://kuzzle.io'
      },
      description: 'The Kuzzle HTTP API',
      license: {
        name: 'Apache 2',
        url: 'http://opensource.org/licenses/apache2.0'
      },
      title: 'Kuzzle API'
    },
    produces: [
      'application/json'
    ],
    schemes: [
      'http'
    ],
    swagger: '2.0',
    paths: {}
  };

  routes.forEach(route => {
    // conforms to the swagger format by replacing the parameters notation :parameter by {parameter}
    route.url_ = route.url.replace(routeUrlMatch, '{$1}');

    if (swagger.paths[route.url_] === undefined) {
      swagger.paths[route.url_] = {};
    }

    if (swagger.paths[route.url_][route.verb] === undefined) {

      if (route.infos === undefined) {
        route.infos = {};
      }

      if (route.infos.description === undefined) {
        route.infos.description = `Controller: ${route.controller}. Action: ${route.action}.`;
      }
      else {
        route.infos.description += `\nController: ${route.controller}. Action: ${route.action}.`;
      }

      if (route.infos.produces === undefined) {
        route.infos.produces = ['applications/json'];
      }

      if (route.infos.parameters === undefined) {
        route.infos.parameters = [];

        let m;
        while ((m = routeUrlMatch.exec(route.url)) !== null) {
          routeUrlMatch.lastIndex++;
          route.infos.parameters.push({
            description: 'TODO',
            in: 'path',
            name: m[1],
            required: true,
            type: 'string'
          });
        }
      }

      if (route.infos.parameters.length === 0) {
        delete route.infos.parameters;
      }

      if (route.infos.responses === undefined) {
        route.infos.responses = {
          '200': {
            description: 'OK'
          }
        };
      }

      swagger.paths[route.url_][route.verb] = route.infos;
    }
  });

  return swagger;
};
