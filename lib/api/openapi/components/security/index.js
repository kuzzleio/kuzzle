"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenApiSecurityUpsertUserComponent = exports.OpenApiSecurityUpsertUser = void 0;
const readYamlFile_1 = require("../../../../util/readYamlFile");
// reading the description of the UpsertUser action in the controller security.
// The yaml objects are then stored in the variables below
const upsertUserObject = (0, readYamlFile_1.readYamlFile)(__dirname + '/upsertUser.yaml');
exports.OpenApiSecurityUpsertUser = upsertUserObject.SecurityUpsertUser;
exports.OpenApiSecurityUpsertUserComponent = upsertUserObject.components.schemas;
//# sourceMappingURL=index.js.map