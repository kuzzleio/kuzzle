/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

/**
 * Creates a notification response from a given room, request object, and content.
 *
 * Expected content members:
 *   - scope: [in|out] - sets the notification scope. Default: undefined
 *   - state: [pending|done] - sets the notification state. Default: undefined
 *   - action: overrides the request action
 *   - All other keys will be added to the "result" part of this notification object
 *
 * @class NotificationToken
 * @param {Request} request - the request object from which the notification is issued
 * @param {string} action - Notification action
 * @param {string} message - Notification message
 */
class NotificationServer {
  constructor(action, message) {
    this.message = message;
    this.action = action;
  }

  toJSON() {
    return {
      status: 200,
      action: this.action,
      info: 'This is an automated server notification',
      message: this.message
    };
  }
}

module.exports = NotificationServer;
