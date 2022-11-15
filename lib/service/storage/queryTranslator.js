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

class KeywordError extends Error {
  constructor(type, name) {
    super(
      `The ${type} "${name}" of Koncorde DSL is not supported for search queries.`
    );

    this.keyword = { name, type };
  }
}

const KONCORDE_OPERATORS = ["and", "or", "not", "bool"];

const KONCORDE_CLAUSES_TO_ES = {
  equals: (content) => ({
    term: {
      ...content,
    },
  }),
  exists: (field) => ({
    exists: {
      field,
    },
  }),
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
        [clause]: content
      };
      // throw new KeywordError("clause", clause);
    }

    return converter(content);
  }
}

module.exports = QueryTranslator;
