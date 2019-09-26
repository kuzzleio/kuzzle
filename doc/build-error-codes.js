/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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

const
  codes = require(`${__dirname}/../lib/config/error-codes/`),
  fs = require('fs'),
  { errors } = require('kuzzle-common-objects');

const header = `---
code: false
type: page
title: Codes
description: error codes definitions
order: 500
---

[//]: # (This documentation is auto-generated)
[//]: # (If you need to update this page, execute: npm run doc-error-codes)

# Error codes


`;

function buildErrorCodes(domains) {
  const
    buffer = Buffer.allocUnsafe(4),
    domainKeys = Object
      .keys(domains)
      .sort((a, b) => domains[a].code - domains[b].code);
  let doc = header;

  for (const domainName of domainKeys) {
    const domain = domains[domainName];

    if (domain.deprecated) {
      continue;
    }

    buffer.writeUInt8(domain.code, 3);
    doc += `\n## 0x${buffer.toString('hex', 3)}: ${domainName}\n\n`;

    for (const subdomainName of Object.keys(domain.subdomains)) {
      const subdomain = domain.subdomains[subdomainName];

      if (subdomain.deprecated) {
        continue;
      }

      buffer.writeUInt16BE(domain.code << 8 | subdomain.code, 2);

      doc += `\n\n### Subdomain: 0x${buffer.toString('hex', 2)}: ${subdomainName}\n\n`;
      doc += '| Id | Error Type (Status Code)             | Message           |\n| ------ | -----------------| ------------------ | ------------------ |\n';

      for (const errorName of Object.keys(subdomain.errors)) {
        const
          error = subdomain.errors[errorName],
          fullName = `${domainName}.${subdomainName}.${errorName}`,
          status = (new errors[error.class]()).status;

        if (!error.deprecated) {
          buffer.writeUInt32BE(
            domain.code << 24 | subdomain.code << 16 | error.code,
            0);
          doc += `| ${fullName}<br/><pre>0x${buffer.toString('hex')}</pre> | [${error.class}](/core/1/api/essentials/errors/handling#${error.class.toLowerCase()}) <pre>(${status})</pre> | ${error.description} |\n`;
        }
      }
      doc += '\n---\n';
    }
    doc += '\n---\n';
  }

  return doc;
}

const output = process.argv[2] === '-o' || process.argv[2] === '--output'
  ? process.argv[3]
  : `${__dirname}/2/api/essentials/errors/codes/index.md`;

const doc = buildErrorCodes(codes.domains);

fs.writeFileSync(output, doc);
