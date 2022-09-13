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

"use strict";

const clc = require("cli-color");

function noop(str) {
  return str;
}

class ColorOutput {
  constructor(opts) {
    // /!\ "opts" might be a string
    const noColors =
      typeof opts === "object" && opts.parent && opts.parent.noColors;

    this.format = {
      error: noColors ? noop : clc.red,
      warn: noColors ? noop : clc.yellow,
      notice: noColors ? noop : clc.cyanBright,
      ok: noColors ? noop : clc.green.bold,
      question: noColors ? noop : clc.whiteBright,
    };
  }

  /* eslint-disable no-console */
  error(str) {
    console.error(this.format.error(str));
  }

  warn(str) {
    console.warn(this.format.warn(str));
  }

  notice(str) {
    console.log(this.format.notice(str));
  }

  question(str) {
    console.log(this.format.question(str));
  }

  ok(str) {
    console.log(this.format.ok(str));
  }

  /* eslint-enable no-console */
}

module.exports = ColorOutput;
