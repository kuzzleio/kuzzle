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

"use strict";

const kerror = require("../../kerror");

class KeywordError extends Error {
  constructor(type, name) {
    super(
      `The ${type} "${name}" of Koncorde DSL is not supported for search queries.`
    );

    this.keyword = { name, type };
  }
}

const KONCORDE_OPERATORS = ["and", "or", "not", "bool"];



/**
 * Parse the Koncorde path to extract the path and the value
 * path have the form "path.to.field[json_value]"
 * 
 * @param {string} path 
 * @returns 
 */
function parseKoncordePath(path) {
  const firstBracket = path.indexOf('[');

  if (firstBracket < 0) {
    return {
      path,
    }
  }

  const lastBracket = path.lastIndexOf(']');

  if (lastBracket < 0) {
    throw kerror.get('services', 'koncorde', 'elastic_translation_error', `Invalid exists path "${path}": missing closing bracket`);
  }

  return {
    path: path.slice(0, firstBracket),
    value: JSON.parse(path.slice(firstBracket + 1, lastBracket)),
  }
}


const KONCORDE_CLAUSES_TO_ES = {
  equals: (content) => ({
    term: {
      ...content,
    },
  }),
  exists: (field) => {
    if (!field || !field.field) {
      throw kerror.get('services', 'koncorde', 'elastic_translation_error', 'Invalid "exists" clause: field is missing');
    }

    const parsedInfo = parseKoncordePath(field.field);

    // If we have a value, we need to use a range query to be sure that the value is the same
    if (parsedInfo.value) {
      return {
        bool: {
          filter: [
            {
              exists: {
                field: parsedInfo.path,
              }
            },
            {
              range: {
                [parsedInfo.path]: {
                  gte: parsedInfo.value,
                  lte: parsedInfo.value,
                }
              }
            }
          ]
        }
      }
    }

    return {
      exists: {
        field: parsedInfo.path,
      },
    }
  },
  geoBoundingBox: (content) => ({
    geo_bounding_box: {
      ...content,
    },
  }),
  geoDistance: (content) => ({
    geo_distance: {
      ...content,
    },
  }),
  geoDistanceRange: (content) => ({
    geo_distance_range: {
      ...content,
    },
  }),
  geoPolygon: (content) => ({
    geo_polygon: {
      ...content,
    },
  }),
  ids: (content) => ({
    ids: {
      ...content,
    },
  }),
  in: (content) => ({
    terms: {
      ...content,
    },
  }),
  missing: (field) => ({
    bool: {
      must_not: [{ exists: { field } }],
    },
  }),
  range: (content) => ({
    range: {
      ...content,
    },
  }),
};

const KONCORDE_OPERATORS_TO_ES = {
  and: (content) => ({
    bool: {
      filter: [...content],
    },
  }),
  bool: undefined,
  not: (content) => {
    const [name, value] = Object.entries(content[0])[0];

    return {
      bool: {
        must_not: [{ [name]: value }],
      },
    };
  },
  or: (content) => ({
    bool: {
      should: [...content],
    },
  }),
};

class QueryTranslator {
  translate(filters) {
    const [name, value] = Object.entries(filters)[0];

    if (KONCORDE_OPERATORS.includes(name)) {
      return this._translateOperator(name, value);
    }

    return this._translateClause(name, value);
  }

  _translateOperator(operator, operands) {
    const converter = KONCORDE_OPERATORS_TO_ES[operator];

    if (converter === undefined) {
      throw new KeywordError("operator", operator);
    }

    const esOperands = [];

    if (operator === "not") {
      esOperands.push(this.translate(operands));
    } else {
      for (const operand of operands) {
        esOperands.push(this.translate(operand));
      }
    }

    return converter(esOperands);
  }

  _translateClause(clause, content) {
    const converter = KONCORDE_CLAUSES_TO_ES[clause];

    if (converter === undefined) {
      return {
        [clause]: content,
      };
    }

    return converter(content);
  }
}

module.exports = QueryTranslator;
