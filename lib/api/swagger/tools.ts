import { readFileSync } from 'fs';
import { load } from 'js-yaml';

export function readYamlfile(path: string): any {
  const yaml = load(readFileSync(path, 'utf-8')) as any;
  return yaml;
}
