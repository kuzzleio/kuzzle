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

const path = '../config/error-codes/';
const internal = require(`${path}internal`);
const external = require(`${path}external`);
const api = require(`${path}/api`);
const network = require(`${path}network`);
const plugins = require(`${path}plugins`);
const fs = require('fs');

function buildSubcodesDoc(errorCodesFiles) {
  
  let doc = '---\ncode: false\ntype: page\ntitle: Error Subcodes\ndescription: error subcodes definitions\norder: 500\n---\n\n# Error subcodes definitions\n';
  for (const domainName of Object.keys(errorCodesFiles)) {
    const domain = errorCodesFiles[domainName];
   
    doc += `\n## ${domainName}, code: ${domain.code}\n\n`;
    for (const subdomainName of Object.keys(domain.subdomains)) {
      const subdomain = domain.subdomains[subdomainName];

      doc += `\n\n### Subdomain: ${subdomainName}, code: ${subdomain.code}\n\n`;
      doc += '| Code | Message          | Class              | Error              | FullName           |\n------ | -----------------| ------------------ | ------------------ | ------------------ |\n';
      for (const errorName of Object.keys(subdomain.errors)) {
        const error = subdomain.errors[errorName];
        
        doc += `${domain.code}${subdomain.code}${error.code}  | \`${error.message.replace(/%s/g, '<placeholder>')}\` | [${error.class}](https://docs.kuzzle.io/core/1/api/essentials/errors/#${error.class.toLowerCase()}) | ${errorName} | ${domainName}.${subdomainName}.${errorName}\n`;
      }
      doc += '\n---\n';
    }
    doc += '\n---\n';
  }
  fs.writeFile('../../doc/1/api/essentials/errors/subcodes/index.md', doc, (err => {
    if (err) {
      throw new Error(err);
    }
  }));
}

buildSubcodesDoc({ internal, external, api, network, plugins });
