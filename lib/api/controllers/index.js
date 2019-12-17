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

const
  { NativeController } = require('./base'),
  Bluebird = require('bluebird'),
  { Request } = require('kuzzle-common-objects');

/**
 * @class IndexController
 * @param {Kuzzle} kuzzle
 */
class IndexController extends NativeController {
  constructor(kuzzle) {
    super(kuzzle, [
      'create',
      'delete',
      'exists',
      'list',
      'mDelete'
    ]);
  }

  /**
   * Deletes multiple indexes or all indexes allow to user
   *
   * Body:
   *  - (optional) indexes: String[] - Index names to delete
   *
   * @param {Request} request
   *
   * @returns {Promise.<Object>}
   */
  mDelete (request) {
    const indexes = this.getBodyArray(request, 'indexes', []);

    return this.publicStorage.listIndexes()
      .then(publicIndexes => publicIndexes.filter(index => indexes.includes(index)))
      .then(filtered => this._allowedIndexes(request, filtered))
      .then(allowed => this.publicStorage.deleteIndexes(allowed))
      .then(deleted => ({
        deleted
      }));
  }

  /**
   * Creates an index
   *
   * @param {Request} request
   *
   * @returns {Promise.<Object>}
   */
  create (request) {
    const index = this.getIndex(request);

    return this.publicStorage.createIndex(index)
      .then(() => {
        // empty response
      });
  }

  /**
   * Deletes the index and associated collections
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  delete (request) {
    const index = this.getIndex(request);

    return this.publicStorage.deleteIndex(index)
      .then(() => ({
        acknowledged: true
      }));
  }

  /**
   * Lists indexes
   *
   * @returns {Promise.<String[]>}
   */
  list () {
    return this.publicStorage.listIndexes()
      .then(indexes => ({
        indexes
      }));
  }

  /**
   * Tells if an index exists
   *
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  exists (request) {
    const index = this.getIndex(request);

    return this.publicStorage.indexExists(index);
  }

  /**
   * Returns a list of indexes allowed to be deleted by the user
   *
   * @param {Request} request
   * @param {String[]} publicIndexes - Complete indexes list
   */
  _allowedIndexes (request, publicIndexes) {
    const allowedIndexes = [];

    const promises = publicIndexes
      .map(index => {
        const deleteIndexRequest = new Request(
          { controller: 'index', action: 'delete', index },
          request.context);

        return request.context.user
          .isActionAllowed(deleteIndexRequest, this.kuzzle)
          .then(isAllowed => {
            if (isAllowed) {
              allowedIndexes.push(index);
            }
          });
      });

    return Bluebird.all(promises)
      .then(() => allowedIndexes);
  }
}

module.exports = IndexController;
