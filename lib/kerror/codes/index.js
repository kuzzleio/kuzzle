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

const assert = require('assert');

const { errors } = require('kuzzle-common-objects');

const { has, isPlainObject } = require('../../util/safeObject');

// codes
const domains = {
  api: require('./api'),
  core: require('./core'),
  network: require('./network'),
  plugin: require('./plugin'),
  protocol: require('./protocol'),
  security: require('./security'),
  services: require('./services'),
  validation: require('./validation')
};

/** Check the format of the error codes files
 *  @param {object} - error config file domain
 */

function checkErrors(subdomain, domain) {
  const codes = new Set();

  for (const [name, error] of Object.entries(subdomain.errors)) {
    assert(
      has(error, 'code'),
      `Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      Number.isInteger(error.code),
      `Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      error.code > 0x0000 && error.code <= 0xFFFF,
      `Error configuration file : Field 'code' must be between 1 and 65535 (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      !codes.has(error.code),
      `Error configuration file : code ${error.code} for error '${name}' is not unique (domain: ${domain.code}, subdomain: ${subdomain.code}).`);

    codes.add(error.code);

    assert(
      has(error, 'message'),
      `Error configuration file : Missing required 'message' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      typeof error.message === 'string',
      `Error configuration file : Field 'message' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);

    assert(
      has(error, 'class'),
      `Error configuration file : Missing required 'class' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      typeof error.class === 'string',
      `Error configuration file : Field 'class' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      has(errors, error.class),
      `Error configuration file : Invalid field 'class' (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}), '${name.class}' does not exist.`);

    // plugin errors aren't required to have descriptions
    if (domain.code !== domains.plugin.code) {
      assert(
        typeof error.description === 'string' && error.description.length > 0,
        `Error configuration file : Field 'description' is required and must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    }

    if (error.deprecated) {
      assert(
        typeof error.deprecated === 'string',
        `Error configuration file : Field 'deprecated' must be a string  (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    }
  }
}

function checkSubdomains(domain) {
  const subdomainCodes = new Set();

  for (const subdomainName of Object.keys(domain.subdomains)) {
    const subdomain = domain.subdomains[subdomainName];

    // Subdomain code for plugins is not required and is automatically set to 0
    if (domain.code !== domains.plugin.code) {
      assert(
        has(subdomain, 'code'),
        `Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    }
    else if (!has(subdomain, 'code')) {
      subdomain.code = 0;
    }

    assert(
      Number.isInteger(subdomain.code),
      `Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      subdomain.code >= 0x00 && subdomain.code <= 0xFF,
      `Error configuration file : Field 'code' must be between 0 and 255 (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      !subdomainCodes.has(subdomain.code),
      `Error configuration file : code ${subdomain.code} for subdomain '${subdomainName}' is not unique (domain: ${domain.code}).`);

    // We don't allow duplicates, except for defaulted plugin subdomain codes
    if (domain.code !== domains.plugin.code || subdomain.code > 0) {
      subdomainCodes.add(subdomain.code);
    }

    assert(
      has(subdomain, 'errors'),
      `Error configuration file : Missing required 'errors' field (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      isPlainObject(subdomain.errors),
      `Error configuration file : Field 'errors' must be an object (domain: ${domain.code}, subdomain: ${subdomainName}).`);

    checkErrors(subdomain, domain);
  }
}

function checkDomains(errorCodesFiles) {
  const domainCodes = new Set();

  for (const domainName of Object.keys(errorCodesFiles)) {
    const domain = errorCodesFiles[domainName];

    assert(
      has(domain, 'code'),
      `Error configuration file : Missing required 'code' field. (domain: '${domainName}').`);
    assert(
      Number.isInteger(domain.code),
      `Error configuration file : Field 'code' must be an integer. (domain: '${domainName}').`);
    assert(
      domain.code >= 0x00 && domain.code <= 0xFF,
      `Error configuration file : Field 'code' must be between 0 and 255. (domain: '${domainName}').`);
    assert(
      !domainCodes.has(domain.code),
      `Error configuration file : code ${domain.code} for domain ${domainName} is not unique.`);

    domainCodes.add(domain.code);

    assert(
      has(domain, 'subdomains'),
      `Error configuration file : Missing required 'subdomains' field. (domain: '${domainName}').`);
    assert(
      isPlainObject(domain.subdomains),
      `Error configuration file : Field 'subdomains' must be an object. (domain: '${domainName}').`);

    checkSubdomains(domain);
  }
}

function loadPluginsErrors(pluginManifest, pluginCode) {
  // @todo (breaking change) this is unacceptable as it allows plugins to
  // overwrite existing native errors.
  // A new, dedicated domain should be created, with a dedicated domain code.
  domains.plugin.subdomains[pluginManifest.name] = {
    code: pluginCode,
    errors: pluginManifest.errors
  };
  checkDomains({ plugin: domains.plugin });
}

checkDomains(domains);

module.exports = {
  checkDomains,
  domains,
  loadPluginsErrors,
};
