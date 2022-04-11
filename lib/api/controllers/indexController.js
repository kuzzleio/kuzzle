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

'use strict';

const Bluebird = require('bluebird');

const { Request } = require('../request');
const { NativeController } = require('./baseController');

/**
 * @class IndexController
 */
class IndexController extends NativeController {
  constructor () {
    super([
      'create',
      'delete',
      'exists',
      'list',
      'mDelete',
      'stats',
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
  async mDelete (request) {
    const indexes = request.getBodyArray('indexes', []);

    const publicIndexes = await this.ask('core:storage:public:index:list');

    const filtered = publicIndexes.filter(index => indexes.includes(index));

    const allowed = await this._allowedIndexes(request, filtered);

    const deleted = await this.ask('core:storage:public:index:mDelete', allowed);

    return { deleted };
  }

  /**
   * Creates an index
   *
   * @param {Request} request
   *
   * @returns {Promise}
   */
  async create (request) {
    const index = request.getIndex();

    await this.ask('core:storage:public:index:create', index);
  }

  /**
   * Deletes the index and associated collections
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async delete (request) {
    const index = request.getIndex();

    await this.ask('core:storage:public:index:delete', index);

    return { acknowledged: true };
  }

  /**
   * Lists indexes
   *
   */
  async list (request) {
    const countCollection = request.getBoolean('countCollection');

    const indexes = await this.ask('core:storage:public:index:list');

    const response = {
      indexes
    };

    if (countCollection) {
      response.collections = {};

      const promises = [];

      for (const index of indexes) {
        promises.push(
          this.ask('core:storage:public:collection:list', index)
            .then(collections => {
              response.collections[index] = collections.length;
            })
        );
      }

      await Bluebird.all(promises);
    }

    return response;
  }

  /**
   * Tells if an index exists
   *
   * @param {Request} request
   * @returns {Promise.<boolean>}
   */
  exists (request) {
    const index = request.getIndex();

    return this.ask('core:storage:public:index:exist', index);
  }

  /**
   * Returns storage stats
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async stats () {
    return this.ask('core:storage:public:index:stats');
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
          { action: 'delete', controller: 'index', index },
          request.context);

        return request.context.user
          .isActionAllowed(deleteIndexRequest)
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
