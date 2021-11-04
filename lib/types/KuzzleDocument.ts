import { JSONObject } from 'kuzzle-sdk';

// Should be in the SDK instead
export interface KuzzleDocument {
  _id: string;

  _source: JSONObject;
}
