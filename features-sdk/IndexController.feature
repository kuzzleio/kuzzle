Feature: index:create

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
