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
      discord: string;
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
  servers: Array<{
    url: string;
    description: string;
    variables: {
      baseUrl: { default: string };
      port: { default: number };
    };
  }>;
  tags: Array<{
    description: string;
    name: string;
  }>;
  schemes: string[];
  paths: JSONObject;
  components: JSONObject;
};
