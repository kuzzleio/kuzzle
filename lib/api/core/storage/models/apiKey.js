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
  errorsManager = require('../../../../util/errors'),
  _ = require('lodash'),
  BaseModel = require('./baseModel');
class ApiKey extends BaseModel {
  constructor (_source, _id = null) {
    super(_source, _id);
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
   *
   * @param {*} user
   * @param {*} connectionId
   * @param {*} expiresIn
   * @param {*} description
   * @param {*} options
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
        { expiresIn, bypassMaxTTL: true }),
      hash = BaseModel.kuzzle.constructor.hash(token.jwt),
      apiKey = new ApiKey({
        hash,
        description,
        userId: user._id,
        expiresAt: token.expiresAt,
        ttl: token.ttl,
        token: token.jwt
      }, apiKeyId);

    await apiKey.save({ userId: creatorId, refresh });

    return apiKey;
  }

  static async load (userId, id) {
    const apiKey = await super.load(id);

    if (userId !== apiKey.userId) {
      errorsManager.throw('services', 'storage', 'not_found', id, {
        message: `ApiKey "${id}" not found for user "${userId}".`
      });
    }

    return apiKey;
  }
}

BaseModel.register(
  ApiKey,
  'api-keys',
  ['userId', 'hash', 'description', 'expiresAt', 'ttl', 'token']);

module.exports = ApiKey;
