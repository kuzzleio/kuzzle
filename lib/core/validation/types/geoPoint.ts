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

import { JSONObject } from "kuzzle-sdk";

import { Koncorde } from "../../shared/KoncordeWrapper";
import BaseType from "../baseType";
import { TypeOptions } from "../typeOptions";

class GeoPointType extends BaseType {
  public typeName = "geo_point";
  public allowChildren = false;
  public allowedTypeOptions: string[] = [];

  validate(
    typeOptions: TypeOptions,
    fieldValue: unknown,
    errorMessages: string[],
  ): boolean {
    // `convertGeopoint` is the one telling a geopoint apart from anything else
    if (Koncorde.convertGeopoint(fieldValue as string | JSONObject) === null) {
      errorMessages.push("Invalid GeoPoint format");
      return false;
    }

    return true;
  }
}

export = GeoPointType;
