import { readYamlFile } from '../../util/readYamlFile';

export * from './document';

// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const OpenApiPayloadsDefinitions = readYamlFile(__dirname + '/payloads.yaml').definitions;
