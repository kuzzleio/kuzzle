import { readYamlFile } from "../../../util/readYamlFile";

export * from "./document";
export * from "./security";

// Document definitions (reusable object for KuzzleRequest and KuzzleResponse)
export const OpenApiPayloadsDefinitions = readYamlFile(
  __dirname + "/payloads.yaml"
).definitions;
