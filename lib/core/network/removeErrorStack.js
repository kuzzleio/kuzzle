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

const util = require('util');

const { hilightUserCode } = require('../../util/stackTrace');

/**
 * utility method: must be invoked by all protocols to remove stack traces
 * from payloads before sending them
 * @param  {Error|Object} data - expected: plain error object or serialized
 *                               request response
 * @returns {*} return the data minus the stack trace
 */
module.exports = data => {
  if (util.isError(data)) {
    if (global.NODE_ENV !== 'development') {
      data.stack = undefined;
    }
    else {
      data.stack = data.stack.split('\n').map(hilightUserCode).join('\n');
    }
  }
  else if (data && data.content && data.content.error) {
    if (global.NODE_ENV !== 'development') {
      data.content.error.stack = undefined;
    }
    else {
      data.content.error.stack = data.content.error.stack
        ? data.content.error.stack.split('\n').map(hilightUserCode).join('\n')
        : undefined;
    }
  }

  return data;
};
