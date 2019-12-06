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

const { NativeController } = require('./base');

/**
 * @class BulkController
 * @param {Kuzzle} kuzzle
 */
class BulkController extends NativeController {
  constructor (kuzzle) {
    super(kuzzle, [
      'import',
      'write',
      'mWrite'
    ]);
  }

  /**
   * Perform a bulk import
   *
   * @param {Request} request
   * @returns {Promise}
   */
  import (request) {
    const
      userId = this.getUserId(request),
      { index, collection } = this.getIndexAndCollection(request),
      refresh = this.getString(request, 'refresh', 'false'),
      bulkData = this.getBodyArray(request, 'bulkData'),
      options = {
        refresh,
        userId
      };

    return this.publicStorage.import(index, collection, bulkData, options)
      .then(({ items, errors }) => ({
        successes: items,
        errors
      }));
  }

  /**
   * Write a document without adding metadata or performing data validation.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  write (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      id = request.input.resource._id,
      content = this.getBody(request),
      refresh = this.getString(request, 'refresh', 'false'),
      notify = this.getBoolean(request, 'notify');

    return this.publicStorage.createOrReplace(
      index,
      collection,
      id,
      content,
      { refresh, injectKuzzleMeta: false }
    )
      .then(result => {
        if (notify && result.created) {
          this.kuzzle.notifier.notifyDocumentCreate(request, result);
        } else if (notify) {
          this.kuzzle.notifier.notifyDocumentReplace(request);
        }

        return {
          _id: result._id,
          _version: result._version,
          _source: result._source
        };
      });
  }

  /**
   * Write several documents without adding metadata or performing data validation.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mWrite (request) {
    const
      { index, collection } = this.getIndexAndCollection(request),
      documents = this.getBodyArray(request, 'documents'),
      refresh = this.getString(request, 'refresh', 'false'),
      notify = this.getBoolean(request, 'notify');

    return this.publicStorage.mCreateOrReplace(
      index,
      collection,
      documents,
      { refresh, injectKuzzleMeta: false }
    )
      .then(({ items, errors }) => {
        if (notify) {
          this.kuzzle.notifier.notifyDocumentMChanges(request, items, true);
        }

        const successes = [];

        for (const item of items) {
          successes.push({
            _id: item._id,
            _source: item._source,
            _version: item._version
          });
        }

        return {
          successes,
          errors
        };
      });
  }

}

module.exports = BulkController;
