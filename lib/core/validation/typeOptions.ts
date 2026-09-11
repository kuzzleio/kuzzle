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

import { Moment } from "moment";

/**
 * A field's `typeOptions`: an arbitrary, user-provided object, narrowed by each
 * validation type into the shape that type actually accepts.
 *
 * The narrowed shapes below describe the options **after**
 * `validateFieldSpecification` has run: that method is what rejects the invalid
 * ones and fills the defaults in, so `validate` may rely on them.
 */
export type TypeOptions = Record<string, unknown>;

/**
 * Bounds of a `date` range, as `validateFieldSpecification` leaves them: either
 * a parsed moment, or the `NOW` literal kept verbatim so that it is resolved at
 * validation time rather than at specification time.
 */
export type DateRangeBound = Moment | "NOW";

export interface DateTypeOptions extends TypeOptions {
  formats?: string[];
  range?: {
    min?: DateRangeBound;
    max?: DateRangeBound;
  };
}

export interface EnumTypeOptions extends TypeOptions {
  values?: string[];
}

export interface GeoShapeTypeOptions extends TypeOptions {
  shapeTypes?: string[];
}

/** Shared by the `email`, `ip_address` and `url` types. */
export interface NotEmptyTypeOptions extends TypeOptions {
  notEmpty?: boolean;
}

export interface NumericTypeOptions extends TypeOptions {
  range?: {
    min?: number;
    max?: number;
  };
}

export interface ObjectTypeOptions extends TypeOptions {
  strict?: boolean;
}

export interface StringTypeOptions extends TypeOptions {
  length?: {
    min?: number;
    max?: number;
  };
}
