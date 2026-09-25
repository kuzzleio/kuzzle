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
import type { JSONObject } from "../../../types/JSONObject";

import { get } from "../../../kerror";
import { isPlainObject } from "../../../util/safeObject";

/**
 * What Koncorde hands a clause or an operator converter. The payloads differ
 * per keyword — `equals` takes an object, `exists` takes an object *or* the
 * path as a string, `and` takes a list — so this is the union the tables
 * accept, and the two converters that need more narrow it themselves.
 */
type KoncordeContent = JSONObject | string | unknown[];

type KoncordeConverter = (content: KoncordeContent) => JSONObject;

/**
 * The payload of a clause that is the same Elasticsearch query under another
 * name, and so is spread into it verbatim. Only `exists` and `missing` accept
 * the string form.
 */
function asClauseObject(content: KoncordeContent): JSONObject {
  if (!isPlainObject(content)) {
    throw get(
      "services",
      "koncorde",
      "elastic_translation_error",
      `Invalid clause payload: expected an object, got ${typeof content}`,
    );
  }

  return content;
}

/**
 * A Koncorde filter, as `translate` recurses over it: one keyword and its
 * payload. Anything else is a malformed filter, and the translation error
 * this module already raises for a malformed `exists` path says so.
 */
function asFilter(value: unknown): JSONObject {
  if (!isPlainObject(value)) {
    throw get(
      "services",
      "koncorde",
      "elastic_translation_error",
      `Invalid operand: expected a filter object, got ${typeof value}`,
    );
  }

  return value;
}

function asFilterList(value: unknown): JSONObject[] {
  if (!Array.isArray(value)) {
    throw get(
      "services",
      "koncorde",
      "elastic_translation_error",
      `Invalid operands: expected a list of filters, got ${typeof value}`,
    );
  }

  return value.map(asFilter);
}

class KeywordError extends Error {
  public keyword: { name: string; type: string };

  constructor(type: string, name: string) {
    super(
      `The ${type} "${name}" of Koncorde DSL is not supported for search queries.`,
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
function parseKoncordePath(path: string): { path: string; value?: unknown } {
  const firstBracket = path.indexOf("[");

  if (firstBracket < 0) {
    return {
      path,
    };
  }

  const lastBracket = path.lastIndexOf("]");

  if (lastBracket < 0) {
    throw get(
      "services",
      "koncorde",
      "elastic_translation_error",
      `Invalid exists path "${path}": missing closing bracket`,
    );
  }

  return {
    path: path.slice(0, firstBracket),
    value: JSON.parse(path.slice(firstBracket + 1, lastBracket)),
  };
}

const KONCORDE_CLAUSES_TO_ES: Record<string, KoncordeConverter> = {
  equals: (content) => ({
    term: {
      ...asClauseObject(content),
    },
  }),
  exists: (field) => {
    // Support old syntax { exists: { field: "path" } } and { exists: "path" }
    const declared = isPlainObject(field) ? field.field : field;

    if (typeof declared !== "string") {
      throw get(
        "services",
        "koncorde",
        "elastic_translation_error",
        `Invalid exists path: expected a string, got ${typeof declared}`,
      );
    }

    const parsedInfo = parseKoncordePath(declared);

    // If we have a value, we need to use a range query to be sure that the value is the same
    if (parsedInfo.value) {
      return {
        bool: {
          filter: [
            {
              exists: {
                field: parsedInfo.path,
              },
            },
            {
              range: {
                [parsedInfo.path]: {
                  gte: parsedInfo.value,
                  lte: parsedInfo.value,
                },
              },
            },
          ],
        },
      };
    }

    return {
      exists: {
        field: parsedInfo.path,
      },
    };
  },
  geoBoundingBox: (content) => ({
    geo_bounding_box: {
      ...asClauseObject(content),
    },
  }),
  geoDistance: (content) => ({
    geo_distance: {
      ...asClauseObject(content),
    },
  }),
  geoDistanceRange: (content) => ({
    geo_distance_range: {
      ...asClauseObject(content),
    },
  }),
  geoPolygon: (content) => ({
    geo_polygon: {
      ...asClauseObject(content),
    },
  }),
  ids: (content) => ({
    ids: {
      ...asClauseObject(content),
    },
  }),
  in: (content) => ({
    terms: {
      ...asClauseObject(content),
    },
  }),
  missing: (field) => ({
    bool: {
      must_not: [{ exists: { field } }],
    },
  }),
  range: (content) => ({
    range: {
      ...asClauseObject(content),
    },
  }),
};

const KONCORDE_OPERATORS_TO_ES: Record<string, KoncordeConverter | undefined> =
  {
    and: (content) => ({
      bool: {
        filter: [...asFilterList(content)],
      },
    }),
    bool: undefined,
    not: (content) => {
      // `not` is handed the single already-translated filter below, so its
      // first entry is the ES clause to negate.
      const [first] = asFilterList(content);
      const [entry] = Object.entries(asFilter(first));

      if (entry === undefined) {
        throw get(
          "services",
          "koncorde",
          "elastic_translation_error",
          "Invalid not operand: the negated filter is empty",
        );
      }

      const [name, value] = entry;

      return {
        bool: {
          must_not: [{ [name]: value }],
        },
      };
    },
    or: (content) => ({
      bool: {
        should: [...asFilterList(content)],
      },
    }),
  };

/*
 * The three public methods below keep v2.56.0's declarations — untyped
 * arguments, an `any` answer — as a public overload in front of the typed
 * implementation: a `JSONObject` answer breaks code compiled against that
 * which assigns it to its own query type.
 */
export class QueryTranslator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- v2.56.0's public type, kept for compatibility
  translate(filters: unknown): any;
  translate(filters: JSONObject): JSONObject {
    const [entry] = Object.entries(filters);

    // An empty filter has no keyword to translate. `BaseController`'s
    // `translateKoncorde` answers `{}` before reaching here; this is what
    // destructuring `Object.entries(filters)[0]` raised a TypeError for.
    if (entry === undefined) {
      throw get(
        "services",
        "koncorde",
        "elastic_translation_error",
        "Invalid filter: no keyword to translate",
      );
    }

    const [name, value] = entry;

    if (KONCORDE_OPERATORS.includes(name)) {
      return this._translateOperator(name, value);
    }

    return this._translateClause(name, value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- v2.56.0's public type, kept for compatibility
  _translateOperator(operator: unknown, operands: unknown): any;
  _translateOperator(operator: string, operands: unknown): JSONObject {
    const converter = KONCORDE_OPERATORS_TO_ES[operator];

    if (converter === undefined) {
      throw new KeywordError("operator", operator);
    }

    const esOperands: JSONObject[] = [];

    if (operator === "not") {
      esOperands.push(this.translate(asFilter(operands)));
    } else {
      for (const operand of asFilterList(operands)) {
        esOperands.push(this.translate(operand));
      }
    }

    return converter(esOperands);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- v2.56.0's public type, kept for compatibility
  _translateClause(clause: unknown, content: unknown): any;
  _translateClause(clause: string, content: unknown): JSONObject {
    const converter = KONCORDE_CLAUSES_TO_ES[clause];

    if (converter === undefined) {
      return {
        [clause]: content,
      };
    }

    if (!isPlainObject(content) && typeof content !== "string") {
      throw get(
        "services",
        "koncorde",
        "elastic_translation_error",
        `Invalid "${clause}" clause: expected an object or a string, got ${typeof content}`,
      );
    }

    return converter(content);
  }
}
