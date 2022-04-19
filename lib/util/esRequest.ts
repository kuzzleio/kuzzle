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

import _ from 'lodash';

// Dynamic index settings specified in the elasticsearch documentation :
// https://www.elastic.co/guide/en/elasticsearch/reference/7.5/index-modules.html#index-modules-settings
const dynamicESSettings = [
  'number_of_replicas',
  'search',
  'search.idle.after',
  'refresh_interval',
  'max_result_window',
  'max_inner_result_window',
  'max_rescore_window',
  'max_docvalue_fields_search',
  'max_script_fields',
  'max_ngram_diff',
  'max_shingle_diff',
  'blocks',
  'blocks.read_only',
  'blocks.read_only_allow_delete',
  'blocks.read',
  'blocks.write',
  'blocks.metadata',
  'max_refresh_listeners',
  'highlight.max_analyzed_offset',
  'max_terms_count',
  'max_regex_length',
  'routing.allocation.enable',
  'routing.rebalance.enable',
  'gc_deletes',
  'default_pipeline',
  'final_pipeline'
];

export function getESIndexDynamicSettings (requestSettings: object): object {
  return _.pick(requestSettings, dynamicESSettings);
}
