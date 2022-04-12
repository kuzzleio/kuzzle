import { ErrorDefinition } from './ErrorDefinition';

/**
 * Represents the domains, subDomains and error names with associated definitions
 */
export type ErrorDomains = {
  [domain: string]: {
    code: number;
    subDomains?: {
      [subDomain: string]: {
        code: number;
        errors: {
          [errorName: string]: ErrorDefinition;
        };
      };
    };
  };
};
