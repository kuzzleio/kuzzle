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

'use strict';

const
  KuzzleInternalError = require('kuzzle-common-objects').errors.InternalError,
  Request = require('kuzzle-common-objects').Request,
  Bluebird = require('bluebird'),
  assertHasBody = require('../../../util/requestAssertions').assertHasBody;

/** @type Kuzzle */
let _kuzzle;

/**
 * @param {Request} request
 * @returns {Promise}
 */
function data (request) {
  const promises = [];

  assertHasBody(request);

  if (request.input.body.fixtures) {
    Object.keys(request.input.body.fixtures).forEach((index => {
      Object.keys(request.input.body.fixtures[index]).forEach(collection => {
        promises.push(_kuzzle.services.list.storageEngine.import(new Request({
          index,
          collection,
          body: {
            bulkData: request.input.body.fixtures[index][collection]
          }
        }))
          .then(response => {
            if (response.partialErrors && response.partialErrors.length > 0) {
              throw new Error(JSON.stringify(response.data.body));
            }

            return response.items;
          })
        );
      });
    }));
  }

  if (request.input.body.mappings) {
    Object.keys(request.input.body.mappings).forEach(index => {
      Object.keys(request.input.body.mappings[index]).forEach(collection => {
        promises.push(_kuzzle.services.list.storageEngine.updateMapping(new Request({
          index,
          collection,
          body: request.input.body.mappings[index][collection]
        })));
      });
    });
  }

  return Bluebird.all(promises)
    .catch(error => {
      const kuzzleError = new KuzzleInternalError(error.message);
      kuzzleError.stack = error.stack;
      _kuzzle.pluginsManager.trigger('log:error', '!! An error occurred during the process.\nHere is the original error message:\n' + error.message);

      throw kuzzleError;
    });
}

/**
 *
 * @param {Kuzzle} kuzzle
 * @returns {data}
 */
module.exports = function cliData (kuzzle) {
  _kuzzle = kuzzle;
  return data;
};
