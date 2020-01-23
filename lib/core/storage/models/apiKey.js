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
  debug = require('../../../util/debug')('kuzzle:models:apiKey'),
  errorsManager = require('../../../util/errors'),
  BaseModel = require('./baseModel');
class ApiKey extends BaseModel {
  constructor (_source, _id = null) {
    super(_source, _id);
  }

  /**
   * @override
   */
  async _afterDelete () {
    const token = await BaseModel.kuzzle.repositories.token.loadForUser(
      this.userId,
      this.token);

    if (token) {
      await BaseModel.kuzzle.repositories.token.expire(token);
    }
  }

  serialize ({ includeToken=false } = {}) {
    const serialized = super.serialize();

    if (! includeToken) {
      delete serialized._source.token;
    }

    return serialized;
  }

  // Static public methods =====================================================

  /**
   * @override
   */
  static get collection () {
    return 'api-keys';
  }

  /**
   * @override
   */
  static get fields () {
    return ['userId', 'description', 'expiresAt', 'ttl', 'token'];
  }

  /**
   * Creates a new API key for an user
   *
   * @param {User} user
   * @param {String} connectionId
   * @param {String} expiresIn - API key expiration date in ms format
   * @param {String} description
   * @param {Object} options - creatorId (null), apiKeyId (null), refresh (null)
   *
   * @returns {ApiKey}
   */
  static async create (
    user,
    connectionId,
    expiresIn,
    description,
    { creatorId=null, apiKeyId=null, refresh } = {}
  ) {
    const
      token = await BaseModel.kuzzle.repositories.token.generateToken(
        user,
        connectionId,
        { bypassMaxTTL: true, expiresIn }),
      apiKey = new ApiKey(
        {
          description,
          expiresAt: token.expiresAt,
          token: token.jwt,
          ttl: token.ttl,
          userId: user._id
        },
        apiKeyId);

    await apiKey.save({ refresh, userId: creatorId });

    return apiKey;
  }

  /**
   * Loads an user API key from the database
   *
   * @param {String} userId - User ID
   * @param {String} id - API key ID
   *
   * @returns {ApiKey}
   */
  static async load (userId, id) {
    const apiKey = await super.load(id);

    if (userId !== apiKey.userId) {
      throw errorsManager.get('services', 'storage', 'not_found', id, {
        message: `ApiKey "${id}" not found for user "${userId}".`
      });
    }

    return apiKey;
  }

  /**
   * Deletes API keys for an user
   *
   * @param {User} user
   * @param {Object} options - refresh (null)
   *
   * @returns {Promise}
   */
  static async deleteByUser (user, { refresh } = {}) {
    debug('Delete ApiKeys for user %a', user);
    return this.deleteByQuery({ term: { userId: user._id } }, { refresh });
  }
}

BaseModel.register(ApiKey);

module.exports = ApiKey;
