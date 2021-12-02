import { readYamlFile } from '../tools';

// reading the description of the Count action in the controller document.
// The yaml objects are then stored in the variables below
const countObject = readYamlFile('./lib/api/openapi/documents/count.yaml');
export const OpenapiDocumentCount = countObject.DocumentCount;
export const OpenapiDocumentCountComponent = countObject.components.schemas;

// reading the description of the Create action in the controller document.
// The yaml objects are then stored in the variables below
const createObject = readYamlFile('./lib/api/openapi/documents/create.yaml');
export const OpenapiDocumentCreate = createObject.DocumentCreate;
export const OpenapiDocumentCreateComponent = createObject.components.schemas;

// reading the description of the CreateOrReplace action in the controller document.
// The yaml objects are then stored in the variables below
const createOrReplaceObject = readYamlFile('./lib/api/openapi/documents/createOrReplace.yaml');
export const OpenapiDocumentCreateOrReplace = createOrReplaceObject.DocumentCreateOrReplace;
export const OpenapiDocumentCreateOrReplaceComponent = createOrReplaceObject.components.schemas;

// reading the description of the Get action in the controller document.
// The yaml objects are then stored in the variables below
const getObject = readYamlFile('./lib/api/openapi/documents/get.yaml');
export const OpenapiDocumentGet = getObject.DocumentGet;
export const OpenapiDocumentGetComponent = getObject.components.schemas;

// reading the description of the Replace action in the controller document.
// The yaml objects are then stored in the variables below
const replaceObject = readYamlFile('./lib/api/openapi/documents/replace.yaml');
export const OpenapiDocumentReplace = replaceObject.DocumentReplace;
export const OpenapiDocumentReplaceComponent = replaceObject.components.schemas;

// reading the description of the Exists action in the controller document.
// The yaml objects are then stored in the variables below
const existsObject = readYamlFile('./lib/api/openapi/documents/exists.yaml');
export const OpenapiDocumentExists = existsObject.DocumentExists;
export const OpenapiDocumentExistsComponent = existsObject.components.schemas;

// reading the description of the Update action in the controller document.
// The yaml objects are then stored in the variables below
const updateObject = readYamlFile('./lib/api/openapi/documents/update.yaml');
export const OpenapiDocumentUpdate = updateObject.DocumentUpdate;
export const OpenapiDocumentUpdateComponent = updateObject.components.schemas;

// reading the description of the Scroll action in the controller document.
// The yaml objects are then stored in the variables below
const scrollObject = readYamlFile('./lib/api/openapi/documents/scroll.yaml');
export const OpenapiDocumentScroll = scrollObject.DocumentScroll;
export const OpenapiDocumentScrollComponent = scrollObject.components.schemas;

// reading the description of the Delete action in the controller document.
// The yaml objects are then stored in the variables below
const deleteObject = readYamlFile('./lib/api/openapi/documents/delete.yaml');
export const OpenapiDocumentDelete = deleteObject.DocumentDelete;
export const OpenapiDocumentDeleteComponent = deleteObject.components.schemas;

// reading the description of the DeleteByQuery action in the controller document.
// The yaml objects are then stored in the variables below
const deleteByQueryObject = readYamlFile('./lib/api/openapi/documents/deleteByQuery.yaml');
export const OpenapiDocumentDeleteByQuery = deleteByQueryObject.DocumentDeleteByQuery;
export const OpenapiDocumentDeleteByQueryComponent = deleteByQueryObject.components.schemas;

// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const DefinitionsDocument = readYamlFile('./lib/api/openapi/payloads.yaml').definitions;
