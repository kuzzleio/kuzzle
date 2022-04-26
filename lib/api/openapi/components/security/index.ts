import { readYamlFile } from '../../../../util/readYamlFile';

// reading the description of the UpsertUser action in the controller security.
// The yaml objects are then stored in the variables below
const upsertUserObject = readYamlFile(__dirname + '/upsertUser.yaml');
export const OpenApiSecurityUpsertUser = upsertUserObject.SecurityUpsertUser;
export const OpenApiSecurityUpsertUserComponent = upsertUserObject.components.schemas;
