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

import { KuzzleError } from "../../kerror/errors";
import * as kerror from "../../kerror";
import { ApplicationManager, Backend } from "./index";
import { CustomErrorDefinition, ErrorDomains } from "../../types";

export class BackendErrors extends ApplicationManager {
  private domains: ErrorDomains = {};

  constructor(application: Backend) {
    super(application);
  }

  /**
   * Register a new standard KuzzleError
   *
   * @param domain Domain name
   * @param subDomain Subdomain name
   * @param name Standard error name
   * @param definition Standard error definition
   *
   * @example
   * ```
   * app.errors.register('app', 'api', 'custom', {
   *   class: 'BadRequestError',
   *   description: 'This is a custom error from API subdomain',
   *   message: 'Custom API error: %s',
   * });
   * ```
   */
  register(
    domain: string,
    subDomain: string,
    name: string,
    definition: CustomErrorDefinition
  ) {
    if (!this.domains[domain]) {
      this.domains[domain] = {
        code: Object.keys(this.domains).length,
        subDomains: {},
      };
    }

    if (!this.domains[domain].subDomains[subDomain]) {
      this.domains[domain].subDomains[subDomain] = {
        code: Object.keys(this.domains[domain].subDomains).length,
        errors: {},
      };
    }

    this.domains[domain].subDomains[subDomain].errors[name] = {
      code: Object.keys(this.domains[domain].subDomains[subDomain].errors)
        .length,
      ...definition,
    };
  }

  /**
   * Get a standardized KuzzleError
   *
   * @param domain Domain name
   * @param subDomain Subdomain name
   * @param name Standard error name
   * @param placeholders Other placeholder arguments
   *
   * @example throw app.errors.get('app', 'api', 'custom', 'Tbilisi');
   *
   * @returns Standardized KuzzleError
   */
  get(
    domain: string,
    subDomain: string,
    name: string,
    ...placeholders
  ): KuzzleError {
    return kerror.rawGet(
      this.domains,
      domain,
      subDomain,
      name,
      ...placeholders
    );
  }

  /**
   * Get a standardized KuzzleError from an existing error to keep the stacktrace
   *
   * @param source Original error
   * @param domain Domain name
   * @param subDomain Subdomain name
   * @param name Standard error name
   * @param placeholders Other placeholder arguments
   *
   * @returns Standardized KuzzleError
   */
  getFrom(
    source: Error,
    domain: string,
    subDomain: string,
    name: string,
    ...placeholders
  ): KuzzleError {
    return kerror.rawGetFrom(
      this.domains,
      source,
      domain,
      subDomain,
      name,
      ...placeholders
    );
  }

  /**
   * Wrap an error manager on the domain and subDomain
   *
   * @param domain Domain name
   * @param subDomain Subdomain to wrap to
   */
  wrap(domain: string, subDomain: string) {
    return kerror.rawWrap(this.domains, domain, subDomain);
  }
}
