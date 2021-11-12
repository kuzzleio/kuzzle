import { readYamlfile } from '../tools';

// reading the description of the Count action in the controller document.
// The yaml objects are then stored in the variables below
const countObject = readYamlfile('./lib/api/swagger/documents/count.yaml');
export const DocumentCount = countObject.DocumentCount;
export const DocumentCountComponent = countObject.components.schemas;
// reading the description of the Replace action in the controller document.
// The yaml objects are then stored in the variables below
const replaceObject = readYamlfile('./lib/api/swagger/documents/replace.yaml');
export const DocumentReplace = replaceObject.DocumentReplace;
export const DocumentReplaceComponent = replaceObject.components.schemas;
// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const DefinitionsDocument = readYamlfile('./lib/api/swagger/documents/definitions.yaml').definitions;
