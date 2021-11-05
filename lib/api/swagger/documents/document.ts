import { readYamlfile } from '../tools';

export const DocumentCount = readYamlfile('./lib/api/swagger/documents/count.yaml').DocumentCreate;
export const DocumentCountComponent = readYamlfile('./lib/api/swagger/documents/count.yaml').components.schemas;
export const DefinitionsDocument = readYamlfile('./lib/api/swagger/documents/definitions.yaml').definitions;
