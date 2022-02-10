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

export class Inflector {
  /**
   * Converts a string to kebab-case
   * https://gist.github.com/thevangelist/8ff91bac947018c9f3bfaad6487fa149#gistcomment-2659294
   *
   * @param string - String to convert to kebab-case
   *
   * @returns kebab-case-string
   */
  static kebabCase (string: string): string {
    return string
      // get all lowercase letters that are near to uppercase ones
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      // replace all spaces and low dash
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Returns a string with the first letter in uppercase
   *
   * @param string String to transform the first letter in uppercase
   */
  static upFirst (string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * Converts a string to PascalCase
   * https://stackoverflow.com/questions/4068573/convert-string-to-pascal-case-aka-uppercamelcase-in-javascript
   */
  static pascalCase (string: string) {
    return `${string}`
      .replace(new RegExp(/[-_]+/, 'g'), ' ')
      .replace(new RegExp(/[^\w\s]/, 'g'), '')
      .replace(
        new RegExp(/\s+(.)(\w*)/, 'g'),
        ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`
      )
      .replace(new RegExp(/\w/), s => s.toUpperCase());
  }

  /**
   * Converts a string to camelCase
   * https://stackoverflow.com/questions/2970525/converting-any-string-into-camel-case
   */
  static camelCase (string) {
    return string.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
  }
}
