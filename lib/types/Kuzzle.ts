import { JSONObject } from "../../index";

export namespace KuzzleTypes {

  export type StartOptions = {
    import?: JSONObject;
    plugins?: JSONObject;
    secretsFile?: JSONObject;
    support?: JSONObject;
    vaultKey?: JSONObject;
    installations?: Array<{
      id: string,
      handler: Function,
      description?: string
    }>;
  };

  export type ImportConfig = {
    mappings?: JSONObject;
    onExistingUsers?: string;
    profiles?: JSONObject; 
    roles?: JSONObject; 
    userMappings?: JSONObject;
    users?: JSONObject;
  };

  export type SupportConfig = {
    fixtures?: JSONObject;
    mappings?: JSONObject;
    securities?: {
      profiles?: JSONObject;
      roles?: JSONObject;
      users?: JSONObject;
    };
  };

};