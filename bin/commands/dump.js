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

module.exports = function commandDump (options) {
  const
    error = string => options.parent.noColors ? string : clc.red(string),
    ok = string => options.parent.noColors ? string: clc.green.bold(string),
    notice = string => options.parent.noColors ? string : clc.cyanBright(string),
    warn = string => options.parent.noColors ? string : clc.yellow(string),
    kuzzle = new (require('../../lib/api/kuzzle'))();

  console.log(notice('[ℹ] Creating dump file...'));

  kuzzle.cli.doAction('dump', {suffix: 'cli'})
    .then(request => {
      console.log(ok('[✔] Done!'));
      console.log('\n' + warn(`[ℹ] Dump has been successfully generated in "${request.result}" folder`));
      console.log(warn('[ℹ] You can send the folder to the kuzzle core team at support@kuzzle.io'));
      process.exit(0);
    })
    .catch(err => {
      console.log(error(`[✖] ${err}`));
      process.exit(1);
    });
};
