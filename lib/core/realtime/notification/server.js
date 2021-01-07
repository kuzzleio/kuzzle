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

/**
 * Creates a notification response from a given room, request object, and content.
 *
 * @class ServerNotification
 * @param {Request} request - the request object from which the notification is issued
 * @param {string} type - Notification type
 * @param {string} message - Notification message
 */
class ServerNotification {
  constructor(type, message) {
    this.status = 200;
    this.info = 'This is an automated server notification';
    this.message = message;
    this.type = type;
    this.node = global.kuzzle.id;
  }
}

module.exports = ServerNotification;
