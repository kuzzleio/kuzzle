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

const fs = require("fs"),
  {
    ColoredFormatter,
    PrefixedFormatter,
    FileFormatter,
  } = require("./formatters");

class ColorOutput {
  constructor(opts) {
    this.terminalFormatter = opts.C
      ? new PrefixedFormatter()
      : new ColoredFormatter();

    this.fileFormatter = new FileFormatter();

    this.fileReport = null;

    if (!opts.R) {
      this.notice(`Upgrade report file: ${opts.output}`);
      this.fileReport = fs.openSync(opts.output, "w", 0o600);
    }
  }

  /* eslint-disable no-console */
  error(str) {
    console.error(this.terminalFormatter.error(str));

    if (this.fileReport) {
      fs.writeSync(this.fileReport, this.fileFormatter.error(str));
    }
  }

  warn(str) {
    console.warn(this.terminalFormatter.warn(str));

    if (this.fileReport) {
      fs.writeSync(this.fileReport, this.fileFormatter.warn(str));
    }
  }

  notice(str) {
    console.log(this.terminalFormatter.notice(str));

    if (this.fileReport) {
      fs.writeSync(this.fileReport, this.fileFormatter.notice(str));
    }
  }

  question(str) {
    console.log(this.terminalFormatter.question(str));

    if (this.fileReport) {
      fs.writeSync(this.fileReport, this.fileFormatter.question(str));
    }
  }

  ok(str) {
    console.log(this.terminalFormatter.ok(str));

    if (this.fileReport) {
      fs.writeSync(this.fileReport, this.fileFormatter.ok(str));
    }
  }

  print(str) {
    console.log(this.terminalFormatter.raw(str));

    if (this.fileReport) {
      fs.writeSync(this.fileReport, this.fileFormatter.raw(str));
    }
  }
  /* eslint-enable no-console */
}

module.exports = ColorOutput;
