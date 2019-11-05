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
  { errors } = require('kuzzle-common-objects'),
  _ = require('lodash'),
  assert = require('assert');

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

/** Check the format of the error-codes config files
 *  @param {object} - error config file domain
 */


function checkErrors(subdomain, domain) {
  const errorCodes = new Set();

  for (const errorName of Object.keys(subdomain.errors)) {
    const error = subdomain.errors[errorName];

    assert(
      !errorCodes.has(error.code),
      `Error configuration file : code ${error.code} for error '${errorName}' is not unique (domain: ${domain.code}, subdomain: ${subdomain.code}).`);

    errorCodes.add(error.code);

    assert(
      Boolean(error.message),
      `Error configuration file : Missing required 'message' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
    assert(
      typeof error.message === 'string',
      `Error configuration file : Field 'message' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
    assert(
      Boolean(error.class),
      `Error configuration file : Missing required 'class' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
    assert(
      typeof error.class === 'string',
      `Error configuration file : Field 'class' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
    assert(
      Boolean(errors[error.class]),
      `Error configuration file : Invalid field 'class' (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}), '${errorName.class}' does not exist.`);
    assert(
      Boolean(error.code),
      `Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
    assert(
      Number.isInteger(error.code),
      `Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
    assert(
      error.code > 0x0000 && error.code <= 0xFFFF,
      `Error configuration file : Field 'code' must be between 0 and 65535 (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
    assert(
      typeof error.description === 'string' && error.description.length > 0,
      `Error configuration file : Field 'description' is required and must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`);
  }
}

function checkSubdomains(domain) {
  const subdomainCodes = new Set();

  for (const subdomainName of Object.keys(domain.subdomains)) {
    const subdomain = domain.subdomains[subdomainName];

    assert(
      !subdomainCodes.has(subdomain.code),
      `Error configuration file : code ${subdomain.code} for subdomain '${subdomainName}' is not unique (domain: ${domain.code}).`);

    if (subdomain.code !== 0x00) {
      subdomainCodes.add(subdomain.code);
    }

    assert(
      Boolean(subdomain.errors),
      `Error configuration file : Missing required 'errors' field (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      _.isPlainObject(subdomain.errors),
      `Error configuration file : Field 'subdomains' must be an object (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      _.has(subdomain, 'code'),
      `Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      Number.isInteger(subdomain.code),
      `Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomainName}).`);
    assert(
      subdomain.code >= 0x00 && subdomain.code <= 0xFF,
      `Error configuration file : Field 'code' must be between 0 and 255 (domain: ${domain.code}, subdomain: ${subdomainName}).`);

    checkErrors(subdomain, domain);
  }
}

function checkDomains(errorCodesFiles) {
  const domainCodes = new Set();

  for (const domainName of Object.keys(errorCodesFiles)) {
    const domain = errorCodesFiles[domainName];

    assert(
      !domainCodes.has(domain.code),
      `Error configuration file : code ${domain.code} for domain ${domainName} is not unique.`);

    domainCodes.add(domain.code);

    assert(
      Boolean(domain.subdomains),
      `Error configuration file : Missing required 'subdomains' field. (domain: '${domainName}').`);
    assert(
      _.isPlainObject(domain.subdomains),
      `Error configuration file : Field 'subdomains' must be an object. (domain: '${domainName}').`);
    assert(
      _.has(domain, 'code'),
      `Error configuration file : Missing required 'code' field. (domain: '${domainName}').`);
    assert(
      Number.isInteger(domain.code),
      `Error configuration file : Field 'code' must be an integer. (domain: '${domainName}').`);
    assert(
      domain.code >= 0x00 && domain.code <= 0xFF,
      `Error configuration file : Field 'code' must be between 0 and 255. (domain: '${domainName}').`);

    checkSubdomains(domain);
  }
}

function loadPluginsErrors(pluginManifest, pluginCode) {
  domains.plugin.subdomains[pluginManifest.name] = {
    code: pluginCode,
    errors: pluginManifest.errors
  };
  checkDomains({ plugin: domains.plugin });
}

checkDomains(domains);

module.exports = {
  domains,
  loadPluginsErrors
};
