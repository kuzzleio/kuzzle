Feature: index:create

  Scenario: Create a new index
    When I call the route "index":"create" with args:
    | index | "nyc-open-data" |
    Then I should receive an empty result

  Scenario: Re-create an existing index
    When I successfully call the route "index":"create" with args:
    | index | "nyc-open-data" |
    And I call the route "index":"create" with args:
    | index | "nyc-open-data" |
    Then I should receive an error matching:
    | status | 400 |
