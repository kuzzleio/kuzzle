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

const { errors } = require('kuzzle-common-objects');
const internal = require('./internal');
const external = require('./external');
const api = require('./api');
const network = require('./network');
const plugins = require('./plugins');
const _ = require('lodash');
const assert = require('assert');

/** Check the format of the error-codes config files
 *  @param {object} - error config file domain
 */


function checkErrors(subdomain, domain) {
  const errorCodes = new Set();

  for (const errorName of Object.keys(subdomain.errors)) {
    const error = subdomain.errors[errorName];

    assert(
      !errorCodes.has(error.code),
      new errors.InternalError(`Error configuration file : code ${error.code} for error '${errorName}' is not unique (domain: ${domain.code}, subdomain: ${subdomain.code}).`));

    errorCodes.add(error.code);

    assert(
      Boolean(error.message),
      new errors.InternalError(`Error configuration file : Missing required 'message' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`));
    assert(
      typeof error.message === 'string',
      new errors.InternalError(`Error configuration file : Field 'message' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`));
    assert(
      Boolean(error.class),
      new errors.InternalError(`Error configuration file : Missing required 'class' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`));
    assert(
      typeof error.class === 'string',
      new errors.InternalError(`Error configuration file : Field 'class' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`));
    assert(
      Boolean(errors[error.class]),
      new errors.InternalError(`Error configuration file : Invalid field 'class' (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}), '${errorName.class}' does not exist.`));
    assert(
      Boolean(error.code),
      new errors.InternalError(`Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`));
    assert(
      Number.isInteger(error.code),
      new errors.InternalError(`Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`));
    assert(
      error.code > 0x0000 && error.code <= 0xFFFF,
      new errors.InternalError(`Error configuration file : Field 'code' must be between 0 and 65535 (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${errorName}).`));
  }
}

function checkSubdomains(domain) {
  const subdomainCodes = new Set();

  for (const subdomainName of Object.keys(domain.subdomains)) {
    const subdomain = domain.subdomains[subdomainName];

    assert(
      !subdomainCodes.has(subdomain.code),
      new errors.InternalError(`Error configuration file : code ${subdomain.code} for subdomain '${subdomainName}' is not unique (domain: ${domain.code}).`));

    if (subdomain.code !== 0x00) {
      subdomainCodes.add(subdomain.code);
    }

    assert(
      Boolean(subdomain.errors),
      new errors.InternalError(`Error configuration file : Missing required 'errors' field (domain: ${domain.code}, subdomain: ${subdomainName}).`));
    assert(
      _.isPlainObject(subdomain.errors),
      new errors.InternalError(`Error configuration file : Field 'subdomains' must be an object (domain: ${domain.code}, subdomain: ${subdomainName}).`));
    assert(
      _.has(subdomain, 'code'),
      new errors.InternalError(`Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomainName}).`));
    assert(
      Number.isInteger(subdomain.code),
      new errors.InternalError(`Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomainName}).`));
    assert(
      subdomain.code >= 0x00 && subdomain.code <= 0xFF,
      new errors.InternalError(`Error configuration file : Field 'code' must be between 0 and 255 (domain: ${domain.code}, subdomain: ${subdomainName}).`));

    checkErrors(subdomain, domain);
  }
}

function checkDomains(errorCodesFiles) {
  const domainCodes = new Set();

  for (const domainName of Object.keys(errorCodesFiles)) {
    const domain = errorCodesFiles[domainName];

    assert(
      !domainCodes.has(domain.code),
      new errors.InternalError(`Error configuration file : code ${domain.code} for domain ${domainName} is not unique.`));

    domainCodes.add(domain.code);

    assert(
      Boolean(domain.subdomains),
      new errors.InternalError(`Error configuration file : Missing required 'subdomains' field. (domain: '${domainName}').`));
    assert(
      _.isPlainObject(domain.subdomains),
      new errors.InternalError(`Error configuration file : Field 'subdomains' must be an object. (domain: '${domainName}').`));
    assert(
      _.has(domain, 'code'),
      new errors.InternalError(`Error configuration file : Missing required 'code' field. (domain: '${domainName}').`));
    assert(
      Number.isInteger(domain.code),
      new errors.InternalError(`Error configuration file : Field 'code' must be an integer. (domain: '${domainName}').`));
    assert(
      domain.code >= 0x00 && domain.code <= 0xFF,
      new errors.InternalError(`Error configuration file : Field 'code' must be between 0 and 255. (domain: '${domainName}').`));

    checkSubdomains(domain);
  }
}

function loadPluginsErrors(pluginManifest, pluginCode) {
 
  plugins.subdomains[pluginManifest.name] = {
    code: pluginCode,
    errors: pluginManifest.errors
  };
  checkDomains({ plugins });
}

checkDomains({ internal, external, api, network, plugins });

module.exports = {
  domains: {
    internal,
    external,
    api,
    network,
    plugins
  },
  loadPluginsErrors
};
