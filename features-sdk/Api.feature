Feature: API

  @mappings
  Scenario: Send Request to the HTTP JSON endpoint
    Given an existing collection "nyc-open-data":"yellow-taxi"
    When I send a HTTP "post" request with:
      | controller | "document"                      |
      | action     | "create"                        |
      | index      | "nyc-open-data"                 |
      | collection | "yellow-taxi"                   |
      | _id        | "foobar-1"                      |
      | body       | { "name": "Aschen", "age": 27 } |
    And The document "foobar-1" content match:
      | name | "Aschen" |
      | age  | 27       |
