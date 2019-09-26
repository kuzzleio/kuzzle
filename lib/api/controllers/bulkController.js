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

const
  errorsManager = require('../../util/errors').wrap('services', 'storage'),
  BaseController = require('./baseController');

/**
 * @class BulkController
 * @param {Kuzzle} kuzzle
 */
class BulkController extends BaseController {
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
      refresh = this.getArg(request, 'refresh', 'string', 'false'),
      bulkData = this.getBodyArg(request, 'bulkData', 'array'),
      options = {
        refresh,
        userId
      };

    return this.publicStorage.import(index, collection, bulkData, options)
      .then(({ items, errors }) => {
        if (errors.length > 0) {
          request.setError(
            errorsManager.get('import_failed', errors));
        }

        const allItems = items.concat(errors);

        return {
          items: allItems,
          errors: errors.length > 0
        };
      });
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
      refresh = this.getArg(request, 'refresh', 'string', 'false'),
      notify = this.tryGetBoolean(request, 'args.notify');

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
      documents = this.getBodyArg(request, 'documents', 'array'),
      refresh = this.getArg(request, 'refresh', 'string', 'false'),
      notify = this.tryGetBoolean(request, 'args.notify');

    return this.publicStorage.mCreateOrReplace(
      index,
      collection,
      documents,
      { refresh, injectKuzzleMeta: false }
    )
      .then(({ items, errors }) => {
        if (errors.length > 0) {
          request.setError(
            errorsManager.get('import_failed', errors));
        }

        if (notify) {
          this.kuzzle.notifier.notifyDocumentMChanges(
            request,
            items,
            true);
        }

        const hits = [];

        for (const item of items) {
          hits.push({
            _id: item._id,
            _source: item._source,
            _version: item._version
          });
        }

        return {
          hits,
          total: hits.length
        };
      });
  }

}

module.exports = BulkController;
