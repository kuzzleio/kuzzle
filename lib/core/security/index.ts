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

import RoleRepository from "./roleRepository";
import { ProfileRepository } from "./profileRepository";
import { TokenRepository } from "./tokenRepository";
import UserRepository from "./userRepository";
import SecurityLoader from "./securityLoader";

/**
 * Wires the security repositories together and initialises them in order.
 *
 * The repositories that reach a sibling (`role` -> `profile`, `user` ->
 * `profile`/`token`) receive this module; the token repository and the loader
 * do not, and their constructors take no argument.
 */
class SecurityModule {
  public role: RoleRepository;
  public profile: ProfileRepository;
  public token: TokenRepository;
  public user: UserRepository;
  public loader: SecurityLoader;

  constructor() {
    this.role = new RoleRepository(this);
    this.profile = new ProfileRepository(this);
    this.token = new TokenRepository();
    this.user = new UserRepository(this);
    this.loader = new SecurityLoader();
  }

  async init() {
    // `role.init()` and `profile.init()` are synchronous: they only register
    // `onAsk` handlers.
    this.role.init();
    this.profile.init();
    await this.token.init();
    await this.user.init();
    // Last: the loader replays security fixtures through the API, so every
    // repository it writes through must already be up.
    await this.loader.init();
  }
}

export = SecurityModule;
