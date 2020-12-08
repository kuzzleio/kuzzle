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

const path = require('path');
const fs = require('fs');
const { domains } = require(`${__dirname}/../lib/kerror/codes/`);
const {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
} = require('../lib/kerror/errors');

const errors = {
  BadRequestError,
  ExternalServiceError,
  ForbiddenError,
  GatewayTimeoutError,
  InternalError,
  KuzzleError,
  NotFoundError,
  PartialError,
  PluginImplementationError,
  PreconditionError,
  ServiceUnavailableError,
  SizeLimitError,
  TooManyRequestsError,
  UnauthorizedError,
};

function getHeader(title) {
  return `---
code: true
type: page
title: "${title}"
description: Error codes definitions
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# ${title}

`;
}

function rimraf (dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fulldir = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      rimraf(fulldir);
    }
    else {
      fs.unlinkSync(fulldir);
    }
  }

  fs.rmdirSync(dir);
}

function clearCodeDirectories (target) {
  for (const entry of fs.readdirSync(target, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      rimraf(path.join(target, entry.name));
    }
  }
}

function deprecatedBadge (deprecated) {
  return deprecated ? `<DeprecatedBadge version="${deprecated}"/>` : '';
}

function buildErrorCodes (name) {
  const domain = domains[name];

  if (domain.deprecated) {
    return null;
  }

  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt8(domain.code, 3);

  let doc = getHeader(`0x${buffer.toString('hex', 3)}: ${name}`);

  for (const [subname, subdomain] of Object.entries(domain.subdomains)) {

    buffer.writeUInt16BE(domain.code << 8 | subdomain.code, 2);

    doc += `\n\n### Subdomain: 0x${buffer.toString('hex', 2)}: ${subname}\n\n`;

    if (subdomain.deprecated) {
      doc += `<DeprecatedBadge version="${subdomain.deprecated}">\n`;
    }

    doc += '| id / code | class / status | message | description |\n';
    doc += '| --------- | -------------- | --------| ----------- |\n';

    for (const [errname, error] of Object.entries(subdomain.errors)) {
      const fullName = `${name}.${subname}.${errname}`;
      const status = (new errors[error.class]()).status;

      buffer.writeUInt32BE(
        domain.code << 24 | subdomain.code << 16 | error.code,
        0);
      doc += `| ${fullName}<br/><pre>0x${buffer.toString('hex')}</pre> ${deprecatedBadge(error.deprecated)} | [${error.class}](/core/2/api/errors/error-codes#${error.class.toLowerCase()}) <pre>(${status})</pre> | ${error.message} | ${error.description} |\n`;
    }
    doc += '\n---\n';
    if (subdomain.deprecated) {
      doc += '</DeprecatedBadge>\n';
    }
  }

  return doc;
}

function run () {
  const output = process.argv[2] === '-o' || process.argv[2] === '--output'
    ? process.argv[3]
    : `${__dirname}/2/api/errors/error-codes`;

  clearCodeDirectories(output);

  for (const name of Object.keys(domains)) {
    const doc = buildErrorCodes(name);

    if (doc !== null) {
      const dirpath = path.join(output, name);

      fs.mkdirSync(dirpath);
      fs.writeFileSync(path.join(dirpath, 'index.md'), doc);
    }
  }
}

run();
