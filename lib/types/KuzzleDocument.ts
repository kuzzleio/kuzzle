import type { JSONObject } from "./JSONObject";

/**
 * @deprecated Use KDocument instead (See https://docs.kuzzle.io/sdk/js/7/essentials/strong-typing/)
 */
export interface KuzzleDocument {
  _id: string;

  _source: JSONObject;
}
