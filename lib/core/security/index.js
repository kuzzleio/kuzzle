/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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
const { ProfileRepository } = require('./profileRepository');
const TokenRepository = require('./tokenRepository');
const UserRepository = require('./userRepository');
const SecurityLoader = require('./securityLoader');

class SecurityModule {
  constructor () {
    this.role = new RoleRepository(this);
    this.profile = new ProfileRepository(this);
    this.token = new TokenRepository();
    this.user = new UserRepository(this);
    this.loader = new SecurityLoader();
  }

  async init () {
    await this.role.init();
    await this.profile.init();
    await this.token.init();
    await this.user.init();
    await this.loader.init();
  }
}

module.exports = SecurityModule;
