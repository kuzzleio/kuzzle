import { readYamlFile } from '../tools';

// reading the description of the Count action in the controller document.
// The yaml objects are then stored in the variables below
const countObject = readYamlFile('./lib/api/openapi/documents/count.yaml');
export const DocumentCount = countObject.DocumentCount;
export const DocumentCountComponent = countObject.components.schemas;
// reading the description of the Create action in the controller document.
// The yaml objects are then stored in the variables below
const createObject = readYamlFile('./lib/api/openapi/documents/create.yaml');
export const DocumentCreate = createObject.DocumentCreate;
export const DocumentCreateComponent = createObject.components.schemas;
// reading the description of the CreateOrReplace action in the controller document.
// The yaml objects are then stored in the variables below
const createOrReplaceObject = readYamlFile('./lib/api/openapi/documents/createOrReplace.yaml');
export const DocumentCreateOrReplace = createOrReplaceObject.DocumentCreateOrReplace;
export const DocumentCreateOrReplaceComponent = createOrReplaceObject.components.schemas;
// reading the description of the Get action in the controller document.
// The yaml objects are then stored in the variables below
const getObject = readYamlFile('./lib/api/openapi/documents/get.yaml');
export const DocumentGet = getObject.DocumentGet;
export const DocumentGetComponent = getObject.components.schemas;
// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const DefinitionsDocument = readYamlFile('./lib/api/openapi/payloads.yaml').definitions;
