Feature: Index Controller

  # index:create ===============================================================

  Scenario: Create a new index
    When I successfully execute the action "index":"create" with args:
      | index | "nyc-open-data" |
    Then I should receive an empty result
    And I execute the action "index":"list"
    Then I should receive a result matching:
      | indexes | ["nyc-open-data"] |

  Scenario: Re-create an existing index
    When I successfully execute the action "index":"create" with args:
      | index | "nyc-open-data" |
    And I execute the action "index":"create" with args:
      | index | "nyc-open-data" |
    Then I should receive an error matching:
      | status | 412 |

  Scenario: Create a index with illegal character
    When I execute the action "index":"create" with args:
      | index | "%kuzzle" |
    Then I should receive an error matching:
      | status | 400 |
    When I execute the action "index":"create" with args:
      | index | "&kuzzle" |
    Then I should receive an error matching:
      | status | 400 |
    When I execute the action "index":"create" with args:
      | index | "kuz.zle" |
    Then I should receive an error matching:
      | status | 400 |

  # index:exists ===============================================================

  Scenario: Test index existence
    Given an index "nyc-open-data"
    When I successfully execute the action "index":"exists" with args:
      | index | "nyc-open-data" |
    Then The result should be "true"
    When I successfully execute the action "index":"exists" with args:
      | index | "mtp-open-data" |
    Then The result should be "false"

  # index:list =================================================================

  Scenario: List indexes
    Given an index "nyc-open-data"
    And an index "mtp-open-data"
    When I successfully execute the action "index":"list"
    Then I should receive a result matching:
      | indexes | ["nyc-open-data", "mtp-open-data"] |

  Scenario: List indexes with collection count
    Given an index "nyc-open-data"
    And a collection "nyc-open-data":"yellow-taxi"
    And a collection "nyc-open-data":"green-taxi"
    And an index "mtp-open-data"
    And a collection "mtp-open-data":"red-taxi"
    When I successfully execute the action "index":"list" with args:
      | countCollection | true |
    Then I should receive a result matching:
      | indexes | ["nyc-open-data", "mtp-open-data"] |
      | collections | { "nyc-open-data": 2, "mtp-open-data": 1 } |

  # index:stats =================================================================

  Scenario: Check storage stats
    Given an index "nyc-open-data"
    And a collection "nyc-open-data":"yellow-taxi"
    And a collection "nyc-open-data":"green-taxi"
    And an index "mtp-open-data"
    And a collection "mtp-open-data":"red-taxi"
    And I "create" the following documents:
      | _id          | body                                  |
      | "document-1" | { "name": "document1", "test": true } |
    And I refresh the collection
    When I successfully execute the action "index":"stats"
    And I should receive a result matching:
      | size_in_bytes | 5030 |
    Then I should receive a "indexes" array of objects matching:
      | name            | size_in_bytes | collections                                                                                 |
      | "nyc-open-data" | 460           | [ { name: "green-taxi", size_in_bytes: 230 }, { name: "yellow-taxi", size_in_bytes: 230 } ] |
      | "mtp-open-data" | 4570          | [ { name: "red-taxi", size_in_bytes: 4570, documentCount: 1 } ]                             |