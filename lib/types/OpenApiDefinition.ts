import { JSONObject } from "kuzzle-sdk";

export type OpenApiDefinition = {
  swagger?: string;
  openapi?: string;

  info: {
    title: string;
    description: string;
    contact: {
      name: string;
      url: string;
      email: string;
    };
    license: {
      name: string;
      url: string;
    };
    version: string;
  };
  externalDocs: {
    description: string;
    url: string;
  };
  tags: Array<{
    description: string;
    name: string;
  }>;
  schemes: string[];
  paths: JSONObject;
  components?: JSONObject;
};
