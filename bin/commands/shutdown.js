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

/* eslint-disable no-console */

const
  clc = require('cli-color');

function commandShutdown(options) {
  const
    kuzzle = new (require('../../lib/api/kuzzle'))(),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    error = string => options.parent.noColors ? string : clc.red(string);

  console.log(notice('[ℹ] Shutting down...'));

  return kuzzle.cli.doAction('shutdown', {})
    .then(() => {
      console.log(notice('[✔] Done!'));
      process.exit(0);
    })
    .catch(err => {
      console.dir(err, {showHidden: true, colors: true});
      console.error(error(`[✖] ${err}`));
      process.exit(1);
    });
}

module.exports = commandShutdown;

