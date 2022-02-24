import { ErrorDefinition } from './ErrorDefinition';

/**
 * Represents the domains, subdomains and error names with associated definitions
 */
export type ErrorDomains = {
  [domain: string]: {
    code: number;
    subdomains: {
      [subDomain: string]: {
        code: number;
        errors: {
          [errorName: string]: ErrorDefinition
        }
      };
    }
  }
};
