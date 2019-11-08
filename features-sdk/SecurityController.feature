Feature: Security Controller

  # security:createApiKey =======================================================

  @security
  Scenario: Create an API key for a user
    Given I create a user "My" with content:
    | profileIds | ["default"] |
    When I successfully call the route "security":"createApiKey" with args:
    | _id | "My" |
    | expiresIn | -1 |
    | refresh | "wait_for" |
    | body | { "description": "Le Huong" } |
    Then The property "_source" of the result should match:
    | expiresAt | -1 |
    | ttl | -1 |
    | description | "Le Huong" |
    And The result should contain a property "_id" of type "string"
    And The result should contain a property "_source.hash" of type "string"
    And The result should contain a property "_source.token" of type "string"
    And I can login with the previously created API key
    # list token to check

  # security:createFirstAdmin ==================================================

  @firstAdmin
  Scenario: Create first admin
    Given I update the role "anonymous" with:
    | document | { "create": true, "update": true } |
    And I update the role "default" with:
    | document | { "delete": true, "get": true } |
    When I successfully call the route "security":"createFirstAdmin" with args:
    | _id | "first-admin" |
    | body | { "credentials": { "local": { "username": "first-admin", "password": "password" } }, "content": {} } |
    Then I should receive a result matching:
    | _source | { "profileIds": ["admin"] } |
    And I'm logged in Kuzzle as user "first-admin" with password "password"
    # Test of roles reset
    And The role "anonymous" should match:
    | * | { "*": true } |
    And The role "default" should match:
    | * | { "*": true } |

  @firstAdmin
  Scenario: Create first admin then reset anonymous and default roles
    Given I update the role "anonymous" with:
    | document | { "create": true, "update": true } |
    And I update the role "default" with:
    | document | { "delete": true, "get": true } |
    When I successfully call the route "security":"createFirstAdmin" with args:
    | _id | "first-admin" |
    | body | { "credentials": { "local": { "username": "first-admin", "password": "password" } }, "content": {} } |
    | reset | true |
    Then I should receive a result matching:
    | _source | { "profileIds": ["admin"] } |
    And I'm logged in Kuzzle as user "first-admin" with password "password"
    # Test of roles reset
    And The role "anonymous" should match the default one
    And The role "default" should match the default one
