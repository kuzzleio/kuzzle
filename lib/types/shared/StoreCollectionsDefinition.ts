import { JSONObject } from "../../../index";

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
