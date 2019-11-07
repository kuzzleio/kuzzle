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

const crypto = require('crypto');

class ApiKeyManager {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;
  }

  async create (creator, user, connectionId, expiresIn, description, { refresh } = {}) {
    const
      token = await this.kuzzle.repositories.token.generateToken(
        user,
        connectionId,
        { expiresIn, bypassMaxTTL: true }),
      hash = this._sha512(token.jwt),
      apiKey = {
        hash,
        description,
        expiresAt: token.expiresAt,
        ttl: token.ttl
      };

    user.apiKeys.push(apiKey);

    await this.kuzzle.internalIndex.update(
      'users',
      user._id,
      { apiKeys: user.apiKeys },
      { userId: creator._id, refresh });

    return apiKey;
  }

  async delete () {

  }

  /**
   * Returns a SHA512 hash encoded in hexadecimal
   *
   * @param {String} text
   *
   * @returns {String}
   */
  _sha512 (text) {
    const hash = crypto.createHmac(
      'sha512',
      this.kuzzle.config.security.jwt.secret);

    hash.update(text);

    return hash.digest('hex');
  }
}

module.exports = ApiKeyManager;