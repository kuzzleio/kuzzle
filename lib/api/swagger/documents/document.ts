import { readYamlfile } from '../tools';

// reading the description of the Count action in the controller document.
// The yaml objects are then stored in the variables below
const countObject = readYamlfile('./lib/api/swagger/documents/count.yaml');
export const DocumentCount = countObject.DocumentCount;
export const DocumentCountComponent = countObject.components.schemas;
// reading the description of the CreateOrReplace action in the controller document.
// The yaml objects are then stored in the variables below
const createOrReplaceObject = readYamlfile('./lib/api/swagger/documents/createOrReplace.yaml');
export const DocumentCreateOrReplace = createOrReplaceObject.DocumentCreateOrReplace;
export const DocumentCreateOrReplaceComponent = createOrReplaceObject.components.schemas;
// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const DefinitionsDocument = readYamlfile('./lib/api/swagger/documents/definitions.yaml').definitions;
