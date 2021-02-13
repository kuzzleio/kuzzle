/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Convert a string to kebab-case
 * https://gist.github.com/thevangelist/8ff91bac947018c9f3bfaad6487fa149#gistcomment-2659294
 *
 * @param string - String to convert to kebab-case
 *
 * @returns kebab-case-string
 */
export function kebabCase (string: string): string {
  return string
    // get all lowercase letters that are near to uppercase ones
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    // replace all spaces and low dash
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert a string to camelCase
 * https://stackoverflow.com/questions/2970525/converting-any-string-into-camel-case
 *
 * @param string - String to convert to camelCase
 *
 * @returns camelCaseString
 */
export function camelize (str: string, options: { upperFirst?: boolean } = {}): string {
  const camelString = str.replace('-', ' ').replace(/(?:^\w\|[A-Z]|\b\w)/g, function (word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');

  if (options.upperFirst) {
    return `${camelString.charAt(0).toUpperCase()}${camelString.substr(1)}`;
  }

  return camelString;
}
