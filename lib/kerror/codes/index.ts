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

import assert from "assert";

import * as errors from "../errors";
import { ErrorDefinition } from "../../types/errors/ErrorDefinition";
import { has, isPlainObject } from "../../util/safeObject";
import api from "./2-api.json";
import cluster from "./8-cluster.json";
import core from "./0-core.json";
import network from "./3-network.json";
import plugin from "./4-plugin.json";
import protocol from "./6-protocol.json";
import security from "./7-security.json";
import services from "./1-services.json";
import validation from "./5-validation.json";

type ErrorEntry = Omit<ErrorDefinition, "description"> & {
  description?: string;
  deprecated?: string;
};

type SubDomain = {
  code: number;
  errors: Record<string, ErrorEntry>;
};

type Domain = {
  code: number;
  subDomains: Record<string, SubDomain>;
};

export type Domains = Record<string, Domain>;

type CheckOptions = {
  plugin?: boolean;
};

const domains: Domains = {
  api: api as Domain,
  cluster: cluster as Domain,
  core: core as Domain,
  network: network as Domain,
  plugin: plugin as Domain,
  protocol: protocol as Domain,
  security: security as Domain,
  services: services as Domain,
  validation: validation as Domain,
};

function checkErrors(
  subdomain: SubDomain,
  domain: Domain,
  options: CheckOptions,
): void {
  const codes = new Set<number>();

  for (const [name, error] of Object.entries(subdomain.errors)) {
    assert(
      has(error, "code"),
      `Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
    );
    assert(
      Number.isInteger(error.code),
      `Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
    );
    assert(
      error.code > 0x0000 && error.code <= 0xffff,
      `Error configuration file : Field 'code' must be between 1 and 65535 (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
    );
    assert(
      !codes.has(error.code),
      `Error configuration file : code ${error.code} for error '${name}' is not unique (domain: ${domain.code}, subdomain: ${subdomain.code}).`,
    );

    codes.add(error.code);

    assert(
      has(error, "message"),
      `Error configuration file : Missing required 'message' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
    );
    assert(
      typeof error.message === "string" && error.message.length > 0,
      `Error configuration file : Field 'message' must be a non-empty string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
    );

    assert(
      has(error, "class"),
      `Error configuration file : Missing required 'class' field (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
    );
    assert(
      typeof error.class === "string",
      `Error configuration file : Field 'class' must be a string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
    );
    assert(
      has(errors, error.class),
      `Error configuration file : Field 'class' must target a known KuzzleError object (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}), '${error.class}' does not exist.`,
    );

    if (!options.plugin) {
      assert(
        typeof error.description === "string" && error.description.length > 0,
        `Error configuration file : Field 'description' must be a non-empty string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
      );
    }

    if (error.deprecated !== undefined && error.deprecated !== null) {
      assert(
        typeof error.deprecated === "string" && error.deprecated.length > 0,
        `Error configuration file : Field 'deprecated' must be a non-empty string (domain: ${domain.code}, subdomain: ${subdomain.code}, error: ${name}).`,
      );
    }
  }
}

function checkSubdomains(domain: Domain, options: CheckOptions): void {
  const subdomainCodes = new Set<number>();

  for (const subdomainName of Object.keys(domain.subDomains)) {
    const subdomain = domain.subDomains[subdomainName];

    if (!options.plugin) {
      assert(
        has(subdomain, "code"),
        `Error configuration file : Missing required 'code' field (domain: ${domain.code}, subdomain: ${subdomainName}).`,
      );
    } else if (!has(subdomain, "code")) {
      subdomain.code = 0;
    }

    assert(
      Number.isInteger(subdomain.code),
      `Error configuration file : Field 'code' must be an integer (domain: ${domain.code}, subdomain: ${subdomainName}).`,
    );
    assert(
      subdomain.code >= 0x00 && subdomain.code <= 0xff,
      `Error configuration file : Field 'code' must be between 0 and 255 (domain: ${domain.code}, subdomain: ${subdomainName}).`,
    );
    assert(
      !subdomainCodes.has(subdomain.code),
      `Error configuration file : code ${subdomain.code} for subdomain '${subdomainName}' is not unique (domain: ${domain.code}).`,
    );

    if (!options.plugin || subdomain.code > 0) {
      subdomainCodes.add(subdomain.code);
    }

    assert(
      has(subdomain, "errors"),
      `Error configuration file : Missing required 'errors' field (domain: ${domain.code}, subdomain: ${subdomainName}).`,
    );
    assert(
      isPlainObject(subdomain.errors),
      `Error configuration file : Field 'errors' must be an object (domain: ${domain.code}, subdomain: ${subdomainName}).`,
    );

    checkErrors(subdomain, domain, options);
  }
}

function checkDomains(
  errorCodesFiles: Domains,
  options: CheckOptions = { plugin: false },
): void {
  const domainCodes = new Set<number>();

  for (const domainName of Object.keys(errorCodesFiles)) {
    const domain = errorCodesFiles[domainName];

    assert(
      has(domain, "code"),
      `Error configuration file : Missing required 'code' field. (domain: '${domainName}').`,
    );
    assert(
      Number.isInteger(domain.code),
      `Error configuration file : Field 'code' must be an integer. (domain: '${domainName}').`,
    );
    assert(
      domain.code >= 0x00 && domain.code <= 0xff,
      `Error configuration file : Field 'code' must be between 0 and 255. (domain: '${domainName}').`,
    );
    assert(
      !domainCodes.has(domain.code),
      `Error configuration file : code ${domain.code} for domain ${domainName} is not unique.`,
    );

    domainCodes.add(domain.code);

    assert(
      has(domain, "subDomains"),
      `Error configuration file : Missing required 'subDomains' field. (domain: '${domainName}').`,
    );
    assert(
      isPlainObject(domain.subDomains),
      `Error configuration file : Field 'subDomains' must be an object. (domain: '${domainName}').`,
    );

    checkSubdomains(domain, options);
  }
}

function loadPluginsErrors(
  pluginManifest: { errors: Record<string, ErrorEntry>; name: string },
  pluginCode: number,
): void {
  domains.plugin.subDomains[pluginManifest.name] = {
    code: pluginCode,
    errors: pluginManifest.errors,
  };
  checkDomains({ plugin: domains.plugin }, { plugin: true });
}

checkDomains(domains);

export { checkDomains, domains, loadPluginsErrors };
