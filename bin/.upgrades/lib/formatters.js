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

class RawFormatter {
  raw(msg) {
    return msg;
  }
}

class ColoredFormatter extends RawFormatter {
  error(msg) {
    return clc.red(msg);
  }

  warn(msg) {
    return clc.yellow(msg);
  }

  notice(msg) {
    return clc.cyan(msg);
  }

  ok(msg) {
    return clc.green(msg);
  }

  question(msg) {
    return clc.whiteBright(msg);
  }
}

class PrefixedFormatter extends RawFormatter {
  error(msg) {
    return `[ERROR] ${msg}`;
  }

  warn(msg) {
    return `[WARN] ${msg}`;
  }

  notice(msg) {
    return `[i] ${msg}`;
  }

  ok(msg) {
    return `[OK] ${msg}`;
  }

  question(msg) {
    return `[?] ${msg}`;
  }
}

class FileFormatter extends PrefixedFormatter {
  error(msg) {
    return Buffer.from(`[${new Date().toISOString()}]${super.error(msg)}\n`);
  }

  warn(msg) {
    return Buffer.from(`[${new Date().toISOString()}]${super.warn(msg)}\n`);
  }

  notice(msg) {
    return Buffer.from(`[${new Date().toISOString()}]${super.notice(msg)}\n`);
  }

  ok(msg) {
    return Buffer.from(`[${new Date().toISOString()}]${super.ok(msg)}\n`);
  }

  question(msg) {
    return Buffer.from(`[${new Date().toISOString()}]${super.question(msg)}\n`);
  }

  // @override
  raw(msg) {
    return Buffer.from(`${msg}\n`);
  }
}

module.exports = { ColoredFormatter, FileFormatter, PrefixedFormatter };
