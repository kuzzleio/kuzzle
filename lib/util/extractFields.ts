/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

import { isPlainObject } from "./safeObject";

interface ExtractedField {
  key: string;
  value: unknown;
}

/**
 * Extract nested fields of an object in a flat array.
 * Example: { field : { 1: "nested", 2: "nested" } } => [ 'field.1', 'field.2' ]
 *
 * @param document - Document to extract fields from
 * @param options - alsoExtractValues (false), fieldsToIgnore ( [ ] )
 *
 * @returns Array of field paths, or of { key, value } pairs when alsoExtractValues is true
 */
function extractFields(
  document: Record<string, unknown>,
  {
    fieldsToIgnore = [],
    alsoExtractValues = false,
  }: { fieldsToIgnore?: string[]; alsoExtractValues?: boolean } = {},
  {
    path = null,
    extractedFields = [],
  }: {
    path?: string | null;
    extractedFields?: Array<string | ExtractedField>;
  } = {},
): Array<string | ExtractedField> {
  for (const [key, value] of Object.entries(document)) {
    if (fieldsToIgnore.includes(key)) {
      continue;
    }

    const currentPath = path ? `${path}.${key}` : key;

    if (isPlainObject(value)) {
      extractFields(
        value as Record<string, unknown>,
        { alsoExtractValues, fieldsToIgnore },
        { extractedFields, path: currentPath },
      );
    } else if (alsoExtractValues) {
      extractedFields.push({ key: currentPath, value });
    } else {
      extractedFields.push(currentPath);
    }
  }

  return extractedFields;
}

export = extractFields;
