import { JSONObject } from '../../index';

export type InstallationConfig = {
  id: string,
  handler: () => Promise<void>,
  description?: string
}
export type StartOptions = {
  import?: JSONObject;
  plugins?: JSONObject;
  secretsFile?: JSONObject;
  support?: JSONObject;
  vaultKey?: JSONObject;
  installations?: Array<InstallationConfig>;
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

