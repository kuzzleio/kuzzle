import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { JSONObject } from 'kuzzle-sdk';

export function readYamlFile(path: string): JSONObject {
  return load(readFileSync(path, 'utf-8'));
}
