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

const crypto = require('crypto');

const debug = require('../../util/debug')('models:storage:apiKey');
const kerror = require('../../kerror');
const BaseModel = require('./baseModel');

function sha256 (string) {
  return crypto.createHash('sha256').update(string).digest('hex');
}

class ApiKey extends BaseModel {
  static get TOKEN_PREFIX () {
    return 'kapikey-';
  }

  constructor (_source, _id = null) {
    super(_source, _id);
  }

  authToken () {
    return this._source.token.replace(ApiKey.TOKEN_PREFIX, '');
  }

  /**
   * @override
   */
  async _afterDelete () {
    const token = await global.kuzzle.ask(
      'core:security:token:get',
      this.userId,
      this.token);

    if (token) {
      await global.kuzzle.ask('core:security:token:delete', token);
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
    return ['userId', 'description', 'expiresAt', 'ttl', 'token', 'fingerprint'];
  }

  /**
   * Creates a new API key for an user
   *
   * @param {User} user
   * @param {String} expiresIn - API key expiration date in ms format
   * @param {String} description
   * @param {Object} options - creatorId (null), apiKeyId (null), refresh (null)
   *
   * @returns {ApiKey}
   */
  static async create (
    user,
    expiresIn,
    description,
    { creatorId=null, apiKeyId=null, refresh } = {}
  ) {
    const token = await global.kuzzle.ask('core:security:token:create', user, {
      bypassMaxTTL: true,
      expiresIn
    });

    const authToken = ApiKey.TOKEN_PREFIX + token.jwt;

    const apiKey = new ApiKey({
      description,
      expiresAt: token.expiresAt,
      fingerprint: sha256(authToken),
      token: authToken,
      ttl: token.ttl,
      userId: user._id,
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
      throw kerror.get('services', 'storage', 'not_found', id, {
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
