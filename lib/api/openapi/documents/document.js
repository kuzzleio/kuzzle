"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionsDocument = exports.DocumentCreateComponent = exports.DocumentCreate = exports.DocumentCountComponent = exports.DocumentCount = void 0;
const tools_1 = require("../tools");
// reading the description of the Count action in the controller document.
// The yaml objects are then stored in the variables below
const countObject = (0, tools_1.readYamlFile)('./lib/api/openapi/documents/count.yaml');
exports.DocumentCount = countObject.DocumentCount;
exports.DocumentCountComponent = countObject.components.schemas;
// reading the description of the Create action in the controller document.
// The yaml objects are then stored in the variables below
const createObject = (0, tools_1.readYamlFile)('./lib/api/openapi/documents/create.yaml');
exports.DocumentCreate = createObject.DocumentCreate;
exports.DocumentCreateComponent = createObject.components.schemas;
// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
exports.DefinitionsDocument = (0, tools_1.readYamlFile)('./lib/api/openapi/payloads.yaml').definitions;
//# sourceMappingURL=document.js.map