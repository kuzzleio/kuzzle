Feature: Collection Controller

  # collection:update ==========================================================

  Scenario: Update a collection mappings and settings
    Given an index "nyc-open-data"
    And I "create" the collection "nyc-open-data":"green-taxi" with:
    | mappings | { "properties": { "name": { "type": "keyword" } } } |
    | settings | { "index": { "blocks": { "write": true } } } |
    When I "update" the collection "nyc-open-data":"green-taxi" with:
    | mappings | { "properties": { "age": { "type": "integer" } } } |
    | settings | { "index": { "blocks": { "write": false } } } |
    And I can create the following document:
    | body | {} |
    And I get mappings of collection "nyc-open-data":"green-taxi"
    And I should receive a result matching:
    | properties | { "name": { "type": "keyword" }, "age": { "type": "integer" } } |

  # collection:delete ==========================================================

  Scenario: Delete a collection
    Given an index "nyc-open-data"
    And a collection "nyc-open-data":"green-taxi"
    When I successfully call the route "collection":"delete" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    Then I should not see the collection "nyc-open-data":"green-taxi"

  # collection:create ==========================================================

  Scenario: Create a new collection with mappings and settings
    Given an index "nyc-open-data"
    When I "create" the collection "nyc-open-data":"green-taxi" with:
    | mappings | { "dynamic": "strict", "properties": { "name": { "type": "keyword" } } } |
    | settings | { "index": { "blocks": { "write": true } } } |
    Then I should see the collection "nyc-open-data":"green-taxi"
    And I can not create the following document:
    | body | {} |
    And I get mappings of collection "nyc-open-data":"green-taxi"
    And I should receive a result matching:
    | dynamic | "strict" |
    | properties | { "name": { "type": "keyword" } } |

  Scenario: Re-create a new collection with mappings and settings
    Given an index "nyc-open-data"
    When I "create" the collection "nyc-open-data":"green-taxi" with:
    | mappings | { "dynamic": "strict", "properties": { "name": { "type": "keyword" } } } |
    | settings | { "index": { "blocks": { "write": true } } } |
    And I "create" the collection "nyc-open-data":"green-taxi" with:
    | mappings | { "properties": { "age": { "type": "integer" } } } |
    | settings | { "index": { "blocks": { "write": false } } } |
    Then I should see the collection "nyc-open-data":"green-taxi"
    And I can create the following document:
    | body | {} |
    And I get mappings of collection "nyc-open-data":"green-taxi"
    And I should receive a result matching:
    | dynamic | "strict" |
    | properties | { "name": { "type": "keyword" }, "age": { "type": "integer" } } |

  Scenario: Create a new collection with incorrect mappings
    Given an index "nyc-open-data"
    When I "create" the collection "nyc-open-data":"green-taxi" with:
    | mappings | { "dynamik": "strict" } |
    Then I should receive an error matching:
    | id | "services.storage.invalid_mapping" |

  Scenario: Create a collection with the same name as the kuzzle hidden one
    Given an index "nyc-open-data"
    When I "create" the collection "nyc-open-data":"_kuzzle_keep" with:
    | mappings | "mappings" |
    Then I should receive an error matching:
    | id | "services.storage.collection_reserved" |

  Scenario: Create a collection with illegal character
    When I "create" the collection "nyc-open-data":"%users" with:
    | mappings | "mappings" |
    Then I should receive an error matching:
    | id | "services.storage.invalid_collection_name" |
    When I "create" the collection "nyc-open-data":"&users" with:
    | mappings | "mappings" |
    Then I should receive an error matching:
    | id | "services.storage.invalid_collection_name" |
    When I "create" the collection "nyc-open-data":"us.ers" with:
    | mappings | "mappings" |
    Then I should receive an error matching:
    | id | "services.storage.invalid_collection_name" |

  @deprecated
  Scenario: Create a new collection with mappings
    Given an index "nyc-open-data"
    When I successfully call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    | body | { "dynamic": "strict", "properties": { "name": { "type": "keyword" } } } |
    Then I should receive a result matching:
    | acknowledged | true |
    And I should see the collection "nyc-open-data":"green-taxi"
    And I get mappings of collection "nyc-open-data":"green-taxi"
    Then I should receive a result matching:
    | dynamic | "strict" |
    | properties | { "name": { "type": "keyword" } } |

  @deprecated
  Scenario: Re-create an existing collection with mappings
    Given an index "nyc-open-data"
    When I successfully call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    | body | { "dynamic": "strict", "properties": { "name": { "type": "keyword" } } } |
    And I successfully call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    | body | { "dynamic": "strict", "properties": { "age": { "type": "integer" } } } |
    And I get mappings of collection "nyc-open-data":"green-taxi"
    Then I should receive a result matching:
    | dynamic | "strict" |
    | properties | { "name": { "type": "keyword" }, "age": { "type": "integer"} } |

  # collection:list ============================================================

  Scenario: List collections
    Given an index "nyc-open-data"
    And a collection "nyc-open-data":"yellow-taxi"
    And a collection "nyc-open-data":"green-taxi"
    And I list collections in index "nyc-open-data"
    Then I should receive a result matching:
    | collections | [{ "name": "green-taxi", "type": "stored" }, { "name": "yellow-taxi", "type": "stored" }] |
