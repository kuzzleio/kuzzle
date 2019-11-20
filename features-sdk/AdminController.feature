Feature: Admin Controller

  # admin:resetSecurity ========================================================

  @security
  Scenario: Expire all tokens
    When I successfully call the route "auth":"createApiKey" with args:
    | expiresIn | -1 |
    | refresh | "wait_for" |
    | body | { "description": "Sigfox API key" } |
    Then The property "_source" of the result should match:
    | expiresAt | -1 |
    | ttl | -1 |
    | description | "Sigfox API key" |
    | token | "_STRING_" |
    And The result should contain a property "_id" of type "string"
    And I can login with the previously created API key
    And I successfully call the route "auth":"searchApiKeys"
    Then I should receive a "hits" array of objects matching:
    | _id | _source.userId | _source.ttl | _source.expiresAt | _source.description |
    | "_STRING_" | "test-admin" | -1 | -1 | "Sigfox API key" |