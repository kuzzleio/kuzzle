import type { JSONObject } from "kuzzle-sdk";

export type InstallationConfig = {
  id: string;
  handler: () => Promise<void>;
  description?: string;
};
export type StartOptions = {
  import?: JSONObject;
  plugins?: JSONObject;
  /** Path to the encrypted secrets file — see `lib/kuzzle/vault.ts`. */
  secretsFile?: string;
  support?: JSONObject;
  /** Key the encrypted secrets file is decrypted with. */
  vaultKey?: string;
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
