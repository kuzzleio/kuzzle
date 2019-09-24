Feature: collection:create

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
