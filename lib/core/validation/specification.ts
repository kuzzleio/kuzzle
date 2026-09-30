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

import type { JSONObject } from "../../types/JSONObject";

import type { TypeOptions } from "./typeOptions";

/**
 * The shapes a collection validation specification passes through.
 *
 * Like `typeOptions` before it ([step 09](../../../docs/adr-001/steps/09-sprint-6-core-ii.md)),
 * every name here existed only as a JSDoc `@typedef` that was never declared:
 * `FieldSpecification`, `StructuredFieldSpecification`, `CollectionSpecification`
 * and `DocumentSpecification` were written in annotations across
 * `validation.js` and `default.config.ts` and resolved to nothing.
 *
 * The distinction the JSDoc could not draw, and which is the whole reason this
 * file has four types rather than one, is **before and after curation**. What a
 * user submits is a flat map of path-keyed fields with almost everything
 * optional; what the validator walks at runtime is a tree, with defaults filled
 * in and `path`/`depth`/`children` added. `curateCollectionSpecification` is
 * the boundary between the two.
 */

/** A field's multivalued constraints, as submitted. */
export interface MultivaluedSpecification {
  value: boolean;
  minCount?: number;
  maxCount?: number;
}

/**
 * One field of a collection specification, as submitted. Keys of the enclosing
 * map are `/`-separated paths (`"address/city"`), which is what gives the tree
 * its shape once curated.
 */
export interface FieldSpecification {
  type: string;
  mandatory?: boolean;
  defaultValue?: unknown;
  description?: string;
  multivalued?: MultivaluedSpecification;
  typeOptions?: TypeOptions;
}

/**
 * A field once curated, as it sits in the tree `curateStructuredFields` builds.
 *
 * The tree's **root** is the single node carrying `root: true` and no `type`:
 * it holds children and nothing else. Every other node is a curated field, so
 * the properties `curateFieldSpecification` guarantees (`mandatory`,
 * `multivalued`, `typeOptions`) are optional here only because the root does
 * not have them.
 */
export interface StructuredFieldSpecification {
  /** Set on the tree root, and only there. */
  root?: boolean;
  type?: string;
  /** The field's key split on `/` — `["address", "city"]`. */
  path?: string[];
  /** `path.length`; the depth counting starts at 1. */
  depth?: number;
  mandatory?: boolean;
  defaultValue?: unknown;
  description?: string;
  multivalued?: MultivaluedSpecification;
  typeOptions?: TypeOptions;
  children?: Record<string, CuratedFieldSpecification>;
}

/**
 * A node hanging off some `children` map: always a curated field, never the
 * root. Everything the root is missing is present here, because it is
 * `curateFieldSpecification` that puts it there —
 *
 * - `type` is checked by `curateFieldSpecificationFormat` before anything else;
 * - `mandatory` and `multivalued.value` are filled by its `defaultsDeep`;
 * - `typeOptions` defaults to `{}` and is then replaced by whatever the owning
 *   type's `validateFieldSpecification` answers;
 * - `path` and `depth` are set by `curateCollectionSpecification` on the way
 *   into the tree.
 *
 * Splitting this out is what lets the walkers stop asking whether each of them
 * is there: they only ever receive children, and a child is always curated.
 */
export interface CuratedFieldSpecification extends StructuredFieldSpecification {
  root?: false;
  type: string;
  path: string[];
  depth: number;
  mandatory: boolean;
  multivalued: MultivaluedSpecification;
  typeOptions: TypeOptions;
  children?: Record<string, CuratedFieldSpecification>;
}

/**
 * A field once `curateFieldSpecification` is done with it, and before the tree
 * gives it its place: everything a curated field carries except `path` and
 * `depth`, which `structureCollectionValidation` assigns from the field's key.
 */
export type UnplacedCuratedField = Omit<
  CuratedFieldSpecification,
  "path" | "depth"
> & {
  path?: string[];
  depth?: number;
};

/** A collection's specification, as submitted. */
export interface CollectionSpecification {
  strict?: boolean;
  fields?: Record<string, FieldSpecification>;
  validators?: JSONObject[];
}

/**
 * A collection's specification once curated: the fields are a tree, and
 * `validators` has been replaced by the Koncorde filter id registered for it
 * (or `null` on a dry run, and when the collection declares no validator).
 */
export interface CuratedCollectionSpecification {
  strict: boolean;
  fields: StructuredFieldSpecification;
  validators: string | null;
}

/** Curated specifications, by index then collection. */
export type DocumentSpecification = Record<
  string,
  Record<string, CuratedCollectionSpecification>
>;

/** Raw specifications as they are stored, by index then collection. */
export type RawSpecification = Record<
  string,
  Record<string, CollectionSpecification>
>;

/**
 * The configuration's startup specifications (`validation`), read as what
 * they are. The configuration's type declares them `Record<string, unknown>`
 * — it is public, and that is what v2.56.0 declared — and what they hold is
 * checked specification by specification when it is curated.
 */
export function configuredSpecifications(): RawSpecification {
  return global.kuzzle.config.validation as RawSpecification;
}

/**
 * What the curation methods answer when asked not to fail fast. `errors` is
 * present exactly when `isValid` is false.
 */
export interface SpecificationValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Verbose validation errors, keyed by where they happened. A field's messages
 * hang off the tree at its own path, so a caller can report them in place.
 */
export interface FieldErrorScope {
  children?: Record<string, FieldErrorScope>;
  messages?: string[];
}

export interface VerboseErrorMessages {
  documentScope?: string[];
  fieldScope?: FieldErrorScope;
}

/**
 * Where validation errors are collected. A flat list when `verbose` is false —
 * in which case nothing is ever pushed to it, because the first failure throws
 * — and the structured holder above when it is true.
 */
export type ErrorMessages = string[] | VerboseErrorMessages;
