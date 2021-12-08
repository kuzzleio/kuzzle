import { readYamlFile } from '../../../util/readYamlFile';

// reading the description of the Count action in the controller document.
// The yaml objects are then stored in the variables below
const countObject = readYamlFile('./lib/api/openapi/documents/count.yaml');
export const OpenApiDocumentCount = countObject.DocumentCount;
export const OpenApiDocumentCountComponent = countObject.components.schemas;

// reading the description of the Create action in the controller document.
// The yaml objects are then stored in the variables below
const createObject = readYamlFile('./lib/api/openapi/documents/create.yaml');
export const OpenApiDocumentCreate = createObject.DocumentCreate;
export const OpenApiDocumentCreateComponent = createObject.components.schemas;

// reading the description of the CreateOrReplace action in the controller document.
// The yaml objects are then stored in the variables below
const createOrReplaceObject = readYamlFile('./lib/api/openapi/documents/createOrReplace.yaml');
export const OpenApiDocumentCreateOrReplace = createOrReplaceObject.DocumentCreateOrReplace;
export const OpenApiDocumentCreateOrReplaceComponent = createOrReplaceObject.components.schemas;

// reading the description of the Get action in the controller document.
// The yaml objects are then stored in the variables below
const getObject = readYamlFile('./lib/api/openapi/documents/get.yaml');
export const OpenApiDocumentGet = getObject.DocumentGet;
export const OpenApiDocumentGetComponent = getObject.components.schemas;

// reading the description of the Replace action in the controller document.
// The yaml objects are then stored in the variables below
const replaceObject = readYamlFile('./lib/api/openapi/documents/replace.yaml');
export const OpenApiDocumentReplace = replaceObject.DocumentReplace;
export const OpenApiDocumentReplaceComponent = replaceObject.components.schemas;

// reading the description of the Exists action in the controller document.
// The yaml objects are then stored in the variables below
const existsObject = readYamlFile('./lib/api/openapi/documents/exists.yaml');
export const OpenApiDocumentExists = existsObject.DocumentExists;
export const OpenApiDocumentExistsComponent = existsObject.components.schemas;

// reading the description of the Update action in the controller document.
// The yaml objects are then stored in the variables below
const updateObject = readYamlFile('./lib/api/openapi/documents/update.yaml');
export const OpenApiDocumentUpdate = updateObject.DocumentUpdate;
export const OpenApiDocumentUpdateComponent = updateObject.components.schemas;

// reading the description of the Scroll action in the controller document.
// The yaml objects are then stored in the variables below
const scrollObject = readYamlFile('./lib/api/openapi/documents/scroll.yaml');
export const OpenApiDocumentScroll = scrollObject.DocumentScroll;
export const OpenApiDocumentScrollComponent = scrollObject.components.schemas;

// reading the description of the Delete action in the controller document.
// The yaml objects are then stored in the variables below
const deleteObject = readYamlFile('./lib/api/openapi/documents/delete.yaml');
export const OpenApiDocumentDelete = deleteObject.DocumentDelete;
export const OpenApiDocumentDeleteComponent = deleteObject.components.schemas;

// reading the description of the DeleteByQuery action in the controller document.
// The yaml objects are then stored in the variables below
const deleteByQueryObject = readYamlFile('./lib/api/openapi/documents/deleteByQuery.yaml');
export const OpenApiDocumentDeleteByQuery = deleteByQueryObject.DocumentDeleteByQuery;
export const OpenApiDocumentDeleteByQueryComponent = deleteByQueryObject.components.schemas;

// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const DefinitionsDocument = readYamlFile('./lib/api/openapi/payloads.yaml').definitions;
