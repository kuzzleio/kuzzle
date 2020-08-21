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

const { NativeController, ifMissingEnum } = require('./base');
const actionEnum = require('../../core/realtime/actionEnum');

/**
 * @class BulkController
 * @param {Kuzzle} kuzzle
 */
class BulkController extends NativeController {
  constructor (kuzzle) {
    super(kuzzle, [
      'import',
      'write',
      'mWrite',
      'deleteByQuery'
    ]);
  }

  /**
   * Perform a bulk import
   *
   * @param {Request} request
   * @returns {Promise}
   */
  async import (request) {
    const userId = this.getUserId(request);
    const { index, collection } = this.getIndexAndCollection(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const bulkData = this.getBodyArray(request, 'bulkData');
    const options = {
      refresh,
      userId
    };

    const { items, errors } = await this.ask(
      'core:store:public:document:bulk',
      index,
      collection,
      bulkData,
      options);

    return {
      errors,
      successes: items
    };
  }

  /**
   * Write a document without adding metadata or performing data validation.
   */
  async write (request) {
    const { index, collection } = this.getIndexAndCollection(request);
    const id = this.getId(request, ifMissingEnum.IGNORE);
    const content = this.getBody(request);
    const refresh = this.getString(request, 'refresh', 'false');
    const notify = this.getBoolean(request, 'notify');

    const result = await this.ask(
      'core:store:public:document:createOrReplace',
      index,
      collection,
      id,
      content,
      { injectKuzzleMeta: false, refresh });

    if (notify) {
      await this.ask(
        'core:realtime:document:notify',
        request,
        actionEnum.WRITE,
        result);
    }

    return {
      _id: result._id,
      _source: result._source,
      _version: result._version
    };
  }

  /**
   * Write several documents without adding metadata or performing data validation.
   */
  async mWrite (request) {
    const { index, collection } = this.getIndexAndCollection(request);
    const documents = this.getBodyArray(request, 'documents');
    const refresh = this.getString(request, 'refresh', 'false');
    const notify = this.getBoolean(request, 'notify');

    const { items, errors } = await this.ask(
      'core:store:public:document:mCreateOrReplace',
      index,
      collection,
      documents,
      { injectKuzzleMeta: false, limits: false, refresh });

    if (notify) {
      await this.kuzzle.ask(
        'core:realtime:document:mNotify',
        request,
        actionEnum.WRITE,
        items);
    }

    const successes = items.map(item => ({
      _id: item._id,
      _source: item._source,
      _version: item._version
    }));

    return {
      errors,
      successes
    };
  }

  /**
   * Directly deletes every documents matching the search query without:
   *  - applying max documents write limit
   *  - fetching deleted documents
   *  - triggering realtime notifications
   */
  async deleteByQuery (request) {
    const { index, collection } = this.getIndexAndCollection(request);
    const query = this.getBodyObject(request, 'query');
    const refresh = this.getString(request, 'refresh', 'false');

    const { deleted } = await this.ask(
      'core:store:public:document:deleteByQuery',
      index,
      collection,
      query,
      { fetch: false, refresh });

    return { deleted };
  }

}

module.exports = BulkController;
