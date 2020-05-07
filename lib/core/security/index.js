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

const RoleRepository = require('./roleRepository');
const ProfileRepository = require('./profileRepository');
const TokenRepository = require('./tokenRepository');
const UserRepository = require('./userRepository');
const loadSecurities = require('./loadSecurities');

/**
 * @class Repositories
 * @param {Kuzzle} kuzzle
 * @constructor
 */
class Repositories {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
    this.profile = new ProfileRepository(kuzzle);
    this.role = new RoleRepository(kuzzle);
    this.user = new UserRepository(kuzzle);
    this.token = new TokenRepository(kuzzle);
  }

  init() {
    this.profile.init();
    this.role.init();
    this.user.init();
    this.token.init();
  }

  // @todo Temporary: will be replaced by an ask event in the near future
  loadSecurities (...args) {
    loadSecurities(this.kuzzle, ...args);
  }
}

module.exports = Repositories;

