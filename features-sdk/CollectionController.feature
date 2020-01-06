Feature: Collection Controller

  # collection:refreshInternal =================================================

  @security
  Scenario: Refresh an internal collection
    Given I successfully call the route "security":"createUser" with args:
    | _id | "aschen" |
    | refresh | false |
    | body | { "content": { "profileIds": ["default"] } } |
    # Refresh success on known collection
    When I successfully call the route "collection":"refreshInternal" with args:
    | collection | "users" |
    Then I successfully call the route "security":"searchUsers"
    And I should receive a "hits" array of objects matching:
    | _id |
    | "test-admin" |
    | "aschen" |
    # Error on unknown collection
    When I call the route "collection":"refreshInternal" with args:
    | collection | "frontend-security" |
    Then I should receive an error matching:
    | id | "api.assert.unexpected_argument" |

  # collection:truncate ========================================================

  Scenario: Truncate a collection
    Given an index "nyc-open-data"
    And I successfully call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    | body | { "dynamic": "strict", "properties": { "name": { "type": "keyword" } } } |
    And an existing collection "nyc-open-data":"green-taxi"
    And I "create" the following documents:
    | _id          | body  |
    | "document-1" | { "name": "document1" } |
    | "document-2" | { "name": "document2" } |
    When I successfully call the route "collection":"truncate" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    And The document "document-1" should not exist
    And The document "document-2" should not exist
    And I successfully call the route "collection":"getMapping" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    | includeKuzzleMeta | true |
    And I should receive a result matching:
    | dynamic | "strict" |
    And The property "properties" of the result should match:
    | name | { "type": "keyword" } |
    And The property "properties._kuzzle_info.properties" of the result should match:
    | author | { "type": "keyword" } |
    | updater | { "type": "keyword" } |
    | createdAt | { "type": "date" } |
    | updatedAt | { "type": "date" } |

  # collection:delete ==========================================================

  Scenario: Delete a collection
    Given an index "nyc-open-data"
    And a collection "nyc-open-data":"green-taxi"
    When I successfully call the route "collection":"delete" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    Then I should not see the collection "nyc-open-data":"green-taxi"

  # collection:create ==========================================================

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

  Scenario: Create a new collection with incorrect mappings
    Given an index "nyc-open-data"
    When I call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "green-taxi" |
    | body | { "dynamik": "strict" } |
    Then I should receive an error matching:
    | status | 400 |

  Scenario: Create a collection with the same name as the kuzzle hidden one
    Given an index "nyc-open-data"
    When I call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "_kuzzle_keep" |
    Then I should receive an error matching:
    | status | 400 |

  Scenario: Create a collection with illegal character
    When I call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "%users" |
    Then I should receive an error matching:
    | status | 400 |
    When I call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "&users" |
    Then I should receive an error matching:
    | status | 400 |
    When I call the route "collection":"create" with args:
    | index | "nyc-open-data" |
    | collection | "us.ers" |
    Then I should receive an error matching:
    | status | 400 |


  # collection:list ============================================================

  Scenario: List collections
    Given an index "nyc-open-data"
    And a collection "nyc-open-data":"yellow-taxi"
    And a collection "nyc-open-data":"green-taxi"
    And I list collections in index "nyc-open-data"
    Then I should receive a result matching:
    | collections | [{ "name": "green-taxi", "type": "stored" }, { "name": "yellow-taxi", "type": "stored" }] |
