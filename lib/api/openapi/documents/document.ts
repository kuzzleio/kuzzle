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

// reading the description of the Replace action in the controller document.
// The yaml objects are then stored in the variables below
const replaceObject = readYamlFile('./lib/api/openapi/documents/replace.yaml');
export const DocumentReplace = replaceObject.DocumentReplace;
export const DocumentReplaceComponent = replaceObject.components.schemas;

// reading the description of the Exists action in the controller document.
// The yaml objects are then stored in the variables below
const existsObject = readYamlFile('./lib/api/openapi/documents/exists.yaml');
export const DocumentExists = existsObject.DocumentExists;
export const DocumentExistsComponent = existsObject.components.schemas;

// reading the description of the Update action in the controller document.
// The yaml objects are then stored in the variables below
const updateObject = readYamlFile('./lib/api/openapi/documents/update.yaml');
export const DocumentUpdate = updateObject.DocumentUpdate;
export const DocumentUpdateComponent = updateObject.components.schemas;

// reading the description of the Scroll action in the controller document.
// The yaml objects are then stored in the variables below
const scrollObject = readYamlFile('./lib/api/openapi/documents/scroll.yaml');
export const DocumentScroll = scrollObject.DocumentScroll;
export const DocumentScrollComponent = scrollObject.components.schemas;

// reading the description of the Delete action in the controller document.
// The yaml objects are then stored in the variables below
const deleteObject = readYamlFile('./lib/api/openapi/documents/delete.yaml');
export const DocumentDelete = deleteObject.DocumentDelete;
export const DocumentDeleteComponent = deleteObject.components.schemas;

// reading the description of the DeleteByQuery action in the controller document.
// The yaml objects are then stored in the variables below
const deleteByQueryObject = readYamlFile('./lib/api/openapi/documents/deleteByQuery.yaml');
export const DocumentDeleteByQuery = deleteByQueryObject.DocumentDeleteByQuery;
export const DocumentDeleteByQueryComponent = deleteByQueryObject.components.schemas;

// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const DefinitionsDocument = readYamlFile('./lib/api/openapi/payloads.yaml').definitions;
