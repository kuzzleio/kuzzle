Feature: Collection Controller

  # collection:create ==========================================================

  Scenario: Create a new collection with mappings
    When I call the route "collection":"create" with args:
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

  Scenario: Re-create an existing collection with mappings
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

  Scenario: Create a new collection with incorrect mappings
    When I call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    | body | { "dynamik": "strict" } |
    Then I should receive an error matching:
    | status | 400 |

  Scenario: Try to create a collection with the same name as the kuzzle hidden one
    When I call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "_kuzzle_keep" |
    Then I should receive an error matching:
    | status | 400 |


  # collection:list ============================================================

  Scenario: List collections
    Given an existing collection "nyc-open-data":"yellow-taxi"
    And I successfully call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    And I list collections in index "nyc-open-data"
    Then I should receive a result matching:
    | collections | [{ "name": "green-taxi", "type": "stored" }, { "name": "yellow-taxi", "type": "stored" }] |