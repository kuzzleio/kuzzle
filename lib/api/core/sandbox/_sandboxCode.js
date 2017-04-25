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

const vm = require('vm');

process.on('message', data => {
  let sandbox = {};

  if (data.sandbox !== undefined) {
    sandbox = data.sandbox;
  }

  if (data.code === undefined) {
    process.send({
      error: 'No code given'
    });
  }

  try {
    const sandboxContext = vm.createContext(sandbox);
    const script = new vm.Script(data.code);
    const result = script.runInContext(sandboxContext);

    process.send({
      result,
      context: sandboxContext
    });
  }
  catch (e) {

    if (e.name === 'SyntaxError') {
      process.send({
        error: 'Error running sandbox code',
        err: {
          name: e.name,
          message: e.message,
          stack: e.stack
        }
      });
    }
    else {
      process.send({
        result: true,
        context: {}
      });
    }
  }
});
