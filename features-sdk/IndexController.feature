Feature: Index Controller

  # index:create ===============================================================

  Scenario: Create a new index
    When I successfully call the route "index":"create" with args:
      | index | "nyc-open-data" |
    Then I should receive an empty result
    And I call the route "index":"list"
    Then I should receive a result matching:
      | indexes | ["nyc-open-data"] |

  Scenario: Re-create an existing index
    When I successfully call the route "index":"create" with args:
      | index | "nyc-open-data" |
    And I call the route "index":"create" with args:
      | index | "nyc-open-data" |
    Then I should receive an error matching:
      | status | 412 |

  Scenario: Create a index with illegal character
    When I call the route "index":"create" with args:
      | index | "%kuzzle" |
    Then I should receive an error matching:
      | status | 400 |
    When I call the route "index":"create" with args:
      | index | "&kuzzle" |
    Then I should receive an error matching:
      | status | 400 |
    When I call the route "index":"create" with args:
      | index | "kuz.zle" |
    Then I should receive an error matching:
      | status | 400 |
