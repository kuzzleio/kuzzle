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
  Bluebird = require('bluebird'),
  {
    BadRequestError,
    KuzzleInternalError
  } = require('kuzzle-common-objects').errors,
  Request = require('kuzzle-common-objects').Request,
  {
    assertArgsHasAttribute
  } = require('../../util/requestAssertions');

/**
 * @class AdminController
 * @param {Kuzzle} kuzzle
 */
class AdminController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  /**
   * Reset the internal storage components (internalEngine index, cache and memory storage)
   */
  resetKuzzleData () {
    this.kuzzle.pluginsManager.trigger('log:info', 'Kuzzle reset initiated: this may take a while...');

    return deleteObjects(this.kuzzle, 'user', {})
      .then(() => this.kuzzle.internalEngine.deleteIndex())
      .then(() => this.kuzzle.pluginsManager.trigger('log:info', 'Kuzzle internal database deleted'))
      .then(() => this.kuzzle.services.list.internalCache.flushdb())
      .then(() => {
        this.kuzzle.indexCache.remove(this.kuzzle.internalEngine.index);
        this.kuzzle.pluginsManager.trigger('log:info', 'Kuzzle internal cache flushed');

        return this.kuzzle.internalEngine.bootstrap.all();
      });
  }

  /**
   * Reset Redis cache
   */
  resetCache (request) {
    assertArgsHasAttribute(request, 'database');

    const
      database = request.input.args.database,
      cacheEngine = this.kuzzle.services.list[database];

    if (! (cacheEngine !== undefined && typeof cacheEngine.flushdb === 'function')) {
      throw new BadRequestError(`Database ${database} not found`);
    }

    return new Bluebird((resolve, reject) => cacheEngine.flushdb(error => error ? reject(error) : resolve()));
  }

  /**
   * Reset all roles, profiles and users
   */
  resetSecurity () {
    const options = {
      refresh: 'wait_for'
    };

    return deleteObjects(this.kuzzle, 'user', options)
      .then(() => deleteObjects(this.kuzzle, 'profile', options))
      .then(() => deleteObjects(this.kuzzle, 'role', options));
  }

  /**
   * Reset all indexes
   */
  resetDatabase () {
    const indexes = Object.keys(this.kuzzle.indexCache.indexes).filter(idx => idx[0] !== '%');

    return Bluebird.map(indexes, index => {
      const request = new Request({ index });

      return this.kuzzle.services.list.storageEngine.deleteIndex(request)
        .then(() => delete this.kuzzle.indexCache.indexes[index]);
    });
  }

  /**
   * Shutdown Kuzzle
   */
  shutdown () {

  }

}

/**
 * @param {Kuzzle} kuzzle
 * @param {string} objectType - must be an existent repository name
 * @param {object} options - options for ES request
 * @param {object} part
 * @param {Promise<undefined>}
 */
function deleteObjects(kuzzle, objectType, options, part = null) {
  if (kuzzle.repositories[objectType] === undefined) {
    throw new KuzzleInternalError(`Unknown objectType ${objectType}, must be one of ${Object.keys(kuzzle.repositories).join(', ')}`);
  }

  if (part === null) {
    return kuzzle.repositories[objectType].search({}, {scroll: '10m', size: 100})
      .then(objects => {
        return deleteObjectsPart(kuzzle, objectType, objects, options)
          .then(() => {
            if (objects.hits.length < objects.total) {
              return deleteObjects(kuzzle, objectType, options, {
                total: objects.total,
                deleted: objects.hits.length,
                scrollId: objects.scrollId
              });
            }

            return null;
          });
      });
  }

  return kuzzle.repositories[objectType].scroll(part.scrollId, '10m')
    .then(objects => {
      return deleteObjectsPart(kuzzle, objectType, objects, options)
        .then(() => {
          part.deleted += objects.hits.length;
          if (part.deleted < part.total) {
            part.scrollId = objects.scrollId;
            return deleteObjects(kuzzle, objectType, options, part);
          }

          return null;
        });
    });
}

function deleteObjectsPart (kuzzle, objectType, objects, options) {
  return Bluebird.map(objects.hits, object => {
    if (['admin', 'default', 'anonymous'].indexOf(object._id) !== -1) {
      return Bluebird.resolve();
    }

    const request = new Request({ _id: object._id });
    request.input.args = options;

    // Some metaprogramming spell to handle deleteUser, deleteRole and deleteProfile actions on securityController
    const securityController = kuzzle.funnel.controllers.security;
    const action = `delete${objectType.charAt(0).toUpperCase()}${objectType.slice(1)}`;

    return securityController[action].apply(securityController, [request]); // eslint-disable-line no-useless-call
  });
}

module.exports = AdminController;
