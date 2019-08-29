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
  _ = require('lodash'),
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

    this.engine = kuzzle.services.list.storageEngine;
  }

  /**
   * Perform a bulk import
   *
   * @param {Request} request
   * @returns {Promise}
   */
  import(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'bulkData');

    // @todo pass directly body.bulkData
    // if (!_.isPlainObject(request.body.bulkData)) {
    //   return errorsManager.reject('missing_or_invalid_import_attribute');
    // }

    return this.engine.import(request)
      .then(response => {
        if (response.partialErrors && response.partialErrors.length > 0) {
          request.setError(errorsManager.getError(
            'document_creations_failed',
            response.partialErrors));
        }

        return response;
      });
  }

  /**
   * Write a document without adding metadata or performing data validation.
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  write(request) {
    assertHasBody(request);
    assertHasIndexAndCollection(request);
    assertIdStartsNotUnderscore(request);

    const notify = this.tryGetBoolean(request, 'args.notify');

    return this.engine.createOrReplace(request, false)
      .then(response => {
        this.kuzzle.indexCache.add(
          request.input.resource.index,
          request.input.resource.collection);

        if (notify && response.created) {
          this.kuzzle.notifier.notifyDocumentCreate(request, response);
        } else if (notify) {
          this.kuzzle.notifier.notifyDocumentReplace(request);
        }

        return response;
      });
  }

  /**
   * Write several documents without adding metadata or performing data validation.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mWrite(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'documents');
    assertBodyAttributeType(request, 'documents', 'array');
    assertHasIndexAndCollection(request);

    const notify = this.tryGetBoolean(request, 'args.notify');

    return this.engine.mcreateOrReplace(request, false)
      .then(response => {
        if (response.error.length > 0) {
          request.setError(
            errorsManager.getError('document_creations_failed', response.error));
        }

        if (notify) {
          this.kuzzle.notifier.notifyDocumentMChanges(
            request,
            response.result,
            true);
        }

        return { hits: response.result, total: response.result.length };
      });
  }

}

module.exports = BulkController;
