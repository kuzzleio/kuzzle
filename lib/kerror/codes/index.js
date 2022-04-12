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

'use strict';

const assert = require('assert');

const errors = require('../errors');
const { has, isPlainObject } = require('../../util/safeObject');

// codes
const domains = {
  api: require('./2-api'),
  cluster: require('./8-cluster.json'),
  core: require('./0-core'),
  network: require('./3-network'),
  plugin: require('./4-plugin'),
  protocol: require('./6-protocol'),
  security: require('./7-security'),
  services: require('./1-services'),
  validation: require('./5-validation'),
};

/** Check the format of the error codes files
 *  @param {object} - error config file domain
 */

function checkErrors (subdomain, domain, options) {
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
      ! codes.has(error.code),
      `Error configuration file : code ${error.code} for error '${name}' is not unique (domain: ${domain.code}, subdomain: ${subdomain.code}).`);

    codes.add(error.code);

    assert(
      has(error, 'message'),
      `Error configuration file : Missing required 'message' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      typeof error.message === 'string' && error.message.length > 0,
      `Error configuration file : Field 'message' must be a non-empty string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);

    assert(
      has(error, 'class'),
      `Error configuration file : Missing required 'class' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      typeof error.class === 'string',
      `Error configuration file : Field 'class' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    assert(
      has(errors, error.class),
      `Error configuration file : Field 'class' must target a known KuzzleError object (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}), '${name.class}' does not exist.`);

    // plugin errors aren't required to have descriptions
    if (! options.plugin) {
      assert(
        typeof error.description === 'string' && error.description.length > 0,
        `Error configuration file : Field 'description' must be a non-empty string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    }

    if (error.deprecated !== undefined && error.deprecated !== null) {
      assert(
        typeof error.deprecated === 'string' && error.deprecated.length > 0,
        `Error configuration file : Field 'deprecated' must be a non-empty string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`);
    }
  }
}

function checkSubdomains (domain, options) {
  const subdomainCodes = new Set();

  for (const subdomainName of Object.keys(domain.subDomains)) {
    const subdomain = domain.subDomains[subdomainName];

    // Subdomain code for plugins is not required and is automatically set to 0
    if (! options.plugin) {
      assert(
        has(subdomain, 'code'),
        `Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    }
    else if (! has(subdomain, 'code')) {
      subdomain.code = 0;
    }

    assert(
      Number.isInteger(subdomain.code),
      `Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      subdomain.code >= 0x00 && subdomain.code <= 0xFF,
      `Error configuration file : Field 'code' must be between 0 and 255 (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      ! subdomainCodes.has(subdomain.code),
      `Error configuration file : code ${subdomain.code} for subdomain '${subdomainName}' is not unique (domain: ${domain.code}).`);

    // We don't allow duplicates, except for defaulted plugin subdomain codes
    if (! options.plugin || subdomain.code > 0) {
      subdomainCodes.add(subdomain.code);
    }

    assert(
      has(subdomain, 'errors'),
      `Error configuration file : Missing required 'errors' field (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      isPlainObject(subdomain.errors),
      `Error configuration file : Field 'errors' must be an object (domain: ${domain.code}, subdomain: ${subdomainName}).`);

    checkErrors(subdomain, domain, options);
  }
}

function checkDomains (errorCodesFiles, options = { plugin: false }) {
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
      ! domainCodes.has(domain.code),
      `Error configuration file : code ${domain.code} for domain ${domainName} is not unique.`);

    domainCodes.add(domain.code);

    assert(
      has(domain, 'subDomains'),
      `Error configuration file : Missing required 'subDomains' field. (domain: '${domainName}').`);
    assert(
      isPlainObject(domain.subDomains),
      `Error configuration file : Field 'subDomains' must be an object. (domain: '${domainName}').`);

    checkSubdomains(domain, options);
  }
}

function loadPluginsErrors (pluginManifest, pluginCode) {
  // @todo this should be in its own, independant domain
  domains.plugin.subDomains[pluginManifest.name] = {
    code: pluginCode,
    errors: pluginManifest.errors
  };
  checkDomains({ plugin: domains.plugin }, { plugin: true });
}

checkDomains(domains);

module.exports = {
  checkDomains,
  domains,
  loadPluginsErrors,
};
