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
  BaseController = require('./baseController'),
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  { Request } = require('kuzzle-common-objects'),
  {
    assertHasBody,
    assertBodyHasAttribute,
    assertBodyAttributeType,
    assertHasIndex
  } = require('../../util/requestAssertions');

/**
 * @class IndexController
 * @param {Kuzzle} kuzzle
 */
class IndexController extends BaseController {
  constructor(kuzzle) {
    super(kuzzle, [
      'create',
      'delete',
      'exists',
      'getAutoRefresh',
      'list',
      'mDelete',
      'refresh',
      'refreshInternal',
      'setAutoRefresh'
    ]);

    this.engine = this.kuzzle.services.publicStorage;
  }

  /**
   * Reset all indexes
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDelete(request) {
    const allowedIndexes = [];

    assertHasBody(request);
    assertBodyHasAttribute(request, 'indexes');

    return this.engine.listIndexes()
      .then(res => {
        const indexes = res.indexes.filter(
          index => _.includes(request.input.body.indexes, index)
        );

        const promises = indexes
          .map(index => request.context.user
            .isActionAllowed(
              new Request(
                { controller: 'index', action: 'delete', index },
                request.context),
              this.kuzzle)
            .then(isAllowed => {
              if (isAllowed) {
                allowedIndexes.push(index);
              }
            }));

        return Bluebird.all(promises);
      })
      .then(() => {
        request.input.body.indexes = allowedIndexes;
        return this.engine.deleteIndexes(request);
      })
      .then(response => {
        response.deleted.forEach(index => this.kuzzle.indexCache.remove(index));

        return response;
      });
  }

  /**
   * Create an empty index
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  create(request) {
    assertHasIndex(request);

    return this.engine.createIndex(request)
      .then(response => {
        this.kuzzle.indexCache.add(request.input.resource.index);

        return response;
      });
  }

  /**
   * Delete the entire index and associated collections
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  delete(request) {
    assertHasIndex(request);

    return this.engine.deleteIndex(request)
      .then(response => {
        this.kuzzle.indexCache.remove(request.input.resource.index);

        return response;
      });
  }

  /**
   * Forces the refresh of the given index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  refresh(request) {
    assertHasIndex(request);

    return this.engine.refreshIndex(request);
  }

  /**
   * @returns {Promise<Object>}
   */
  list() {
    return this.engine.listIndexes();
  }

  /**
   * Forces the refresh of the internal index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @returns {Promise<Object>}
   */
  refreshInternal() {
    return this.kuzzle.internalIndex.refresh()
      .then(() => ({acknowledged: true}));
  }

  /**
   * Gets the current autoRefresh value for the current index.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getAutoRefresh(request) {
    assertHasIndex(request);

    return this.engine.getAutoRefresh(request);
  }

  /**
   * Sets elasticsearch autorefresh on/off for current index.
   * /!\ Can lead to some performances issues.
   * cf https://www.elastic.co/guide/en/elasticsearch/guide/current/near-real-time.html
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  setAutoRefresh(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'autoRefresh');
    assertBodyAttributeType(request, 'autoRefresh', 'boolean');

    return this.engine.setAutoRefresh(request)
      .then(response => ({response}));
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  exists(request) {
    assertHasIndex(request);

    return this.engine.indexExists(request);
  }
}

module.exports = IndexController;
