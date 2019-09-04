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
  errorsManager = require('../../config/error-codes/throw').wrap('api', 'bulk'),
  BaseController = require('./baseController'),
  {
    assertHasBody,
    assertBodyHasAttribute,
    assertHasIndexAndCollection,
    assertBodyAttributeType,
    assertIdStartsNotUnderscore
  } = require('../../util/requestAssertions');

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
  import(request) {
    // @todo user getIndexAndCollection(request) instead
    assertHasIndexAndCollection(request);

    const
      userId = this.getUserId(request),
      index = request.input.resource.index,
      collection = request.input.resource.collection,
      refresh = this.stringParam(request, 'args.refresh', undefined),
      bulkData = this.arrayParam(request, 'body.bulkData'),
      options = {
        refresh,
        userId
      };

    return this.storageEngine.import(index, collection, bulkData, options)
      .then(({ result, errors }) => {
        if (errors.length > 0) {
          request.setError(errorsManager.getError(
            'document_creations_failed',
            errors));
        }

        const items = result.concat(errors);

        return {
          items,
          errors: errors.length > 0
        };
      });
  }

  /**
   * Write a document without adding metadata or performing data validation.
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  write(request) {
    assertHasIndexAndCollection(request);
    assertIdStartsNotUnderscore(request);

    const
      index = request.input.resource.index,
      collection = request.input.resource.collection,
      id = request.input.resource._id,
      content = this.objectParam(request, 'body'),
      refresh = this.stringParam(request, 'args.refresh', undefined),
      notify = this.tryGetBoolean(request, 'args.notify');

    return this.storageEngine.createOrReplace(
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
          _source: result._source,
        };
      });
  }

  /**
   * Write several documents without adding metadata or performing data validation.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mWrite(request) {
    assertHasIndexAndCollection(request);

    const
      index = request.input.resource.index,
      collection = request.input.resource.collection,
      documents = this.arrayParam(request, 'body.documents'),
      refresh = this.stringParam(request, 'args.refresh', undefined),
      notify = this.tryGetBoolean(request, 'args.notify');

    return this.storageEngine.mCreateOrReplace(
      index,
      collection,
      documents,
      { refresh, injectKuzzleMeta: false }
    )
      .then(({ result, errors }) => {
        if (errors.length > 0) {
          request.setError(
            errorsManager.getError('document_creations_failed', errors));
        }

        if (notify) {
          this.kuzzle.notifier.notifyDocumentMChanges(
            request,
            result,
            true);
        }

        const hits = [];

        for (const hit of result) {
          hits.push({
            _id: hit._id,
            _source: hit._source,
            _version: hit._version,
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
