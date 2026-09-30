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

import Notifier from "./notifier";
import { HotelClerk } from "./hotelClerk";

/**
 * Wires the realtime components together. Both receive this module: the
 * notifier reads `module.hotelClerk.rooms` to resolve a room's channels.
 */
class RealtimeModule {
  public notifier: Notifier;
  public hotelClerk: HotelClerk;

  constructor() {
    this.notifier = new Notifier(this);
    this.hotelClerk = new HotelClerk(this);
  }

  async init() {
    await this.notifier.init();
    await this.hotelClerk.init();
  }
}

export = RealtimeModule;
