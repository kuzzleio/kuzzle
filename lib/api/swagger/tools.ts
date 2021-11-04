import { readFileSync } from 'fs';
import { load } from 'js-yaml';

export function readYamlfile(path: string): any {
  try {
    const yaml = load(readFileSync(path, 'utf-8')) as any;
    return yaml;
  } catch (e) {
    throw e
  }
}
