import type { JSONObject } from "../JSONObject";

export interface StoreCollectionDefinition {
  /**
   * Collection mappings
   */
  mappings: JSONObject;
  /**
   * Collection settings
   */
  settings?: JSONObject;
}

export type StoreCollectionsDefinition = Record<
  string,
  StoreCollectionDefinition
>;
