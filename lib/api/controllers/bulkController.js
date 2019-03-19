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
  BaseController = require('./controller'),
  {errors: {PartialError}} = require('kuzzle-common-objects'),
  {assertHasBody, assertBodyHasAttribute} = require('../../util/requestAssertions');

/**
 * @class BulkController
 * @param {Kuzzle} kuzzle
 */
class BulkController extends BaseController {
  constructor (kuzzle) {
    super(kuzzle, ['import']);
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

    return this.engine.import(request)
      .then(response => {
        if (response.partialErrors && response.partialErrors.length > 0) {
          request.setError(new PartialError('Some data was not imported.', response.partialErrors));
        }

        return response;
      });
  }
}

module.exports = BulkController;
