import { readYamlfile } from "../tools";

export const DocumentCount = readYamlfile('./lib/api/swagger/documents/count.yaml')
export const DefinitionsDocument = readYamlfile('./lib/api/swagger/documents/definitions.yaml');
