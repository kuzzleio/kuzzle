Feature: Security Controller

  # security:refresh ===========================================================

  @security
  Scenario: Refresh a security collection
    Given I successfully call the route "security":"createUser" with args:
    | _id | "aschen" |
    | refresh | false |
    | body | { "content": { "profileIds": ["default"] } } |
    # Refresh success on known collection
    When I successfully call the route "security":"refresh" with args:
    | collection | "users" |
    Then I successfully call the route "security":"searchUsers"
    And I should receive a "hits" array of objects matching:
    | _id |
    | "test-admin" |
    | "aschen" |
    # Error on unknown collection
    When I call the route "security":"refresh" with args:
    | collection | "frontend-security" |
    Then I should receive an error matching:
    | id | "api.assert.unexpected_argument" |

  # security:createApiKey ======================================================

  @security @login
  Scenario: Create an API key for an user
    Given I create a user "My" with content:
    | profileIds | ["default"] |
    When I successfully call the route "security":"createApiKey" with args:
    | userId | "My" |
    | expiresIn | -1 |
    | refresh | "wait_for" |
    | body | { "description": "Le Huong" } |
    Then The property "_source" of the result should match:
    | expiresAt | -1 |
    | ttl | -1 |
    | description | "Le Huong" |
    | token | "_STRING_" |
    And The result should contain a property "_id" of type "string"
    And I can login with the previously created API key
    And I successfully call the route "security":"searchApiKeys" with args:
    | userId | "My" |
    Then I should receive a "hits" array of objects matching:
    | _id | _source.userId | _source.ttl | _source.expiresAt | _source.description |
    | "_STRING_" | "My" | -1 | -1 | "Le Huong" |

  # security:searchApiKeys =====================================================

  @security
  Scenario: Search for an user API keys
    Given I create a user "My" with content:
    | profileIds | ["default"] |
    And I successfully call the route "security":"createApiKey" with args:
    | userId | "My" |
    | expiresIn | -1 |
    | body | { "description": "Le Huong" } |
    And I successfully call the route "security":"createApiKey" with args:
    | userId | "test-admin" |
    | expiresIn | -1 |
    | body | { "description": "Sigfox API key" } |
    And I successfully call the route "security":"createApiKey" with args:
    | userId | "test-admin" |
    | expiresIn | -1 |
    | body | { "description": "Lora API key" } |
    And I successfully call the route "security":"createApiKey" with args:
    | userId | "test-admin" |
    | expiresIn | -1 |
    | refresh | "wait_for" |
    | body | { "description": "Lora API key 2" } |
    When I successfully call the route "security":"searchApiKeys" with args:
    | userId | "test-admin" |
    | body | { "match": { "description": "Lora" } } |
    Then I should receive a "hits" array of objects matching:
    | _id | _source.userId | _source.ttl | _source.expiresAt | _source.description |
    | "_STRING_" | "test-admin" | -1 | -1 | "Lora API key" |
    | "_STRING_" | "test-admin" | -1 | -1 | "Lora API key 2" |

  # security:deleteApiKey =======================================================

  @security
  Scenario: Delete an API key for an user
    Given I successfully call the route "security":"createApiKey" with args:
    | userId | "test-admin" |
    | _id | "SGN-HCM" |
    | expiresIn | -1 |
    | body | { "description": "My Le Huong" } |
    And I save the created API key
    When I successfully call the route "security":"deleteApiKey" with args:
    | userId | "test-admin" |
    | _id | "SGN-HCM" |
    | refresh | "wait_for" |
    And I successfully call the route "security":"searchApiKeys" with args:
    | userId | "test-admin" |
    Then I should receive a empty "hits" array
    And I can not login with the previously created API key


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

  Scenario: Delete a profile
    Given I create a role "test-role" with the following API rights:
    | document | { "actions": { "create": true, "update": true } } |
    And I create a profile "test-profile" with the following policies:
    | test-role | [{ "index": "example", "collections": ["one", "two"] }] |
    Then I delete the profile "test-profile"
    And I delete the role "test-role"

  Scenario: Delete a profile while being assigned to a user
    Given I create a role "test-role" with the following API rights:
    | document | { "actions": { "create": true, "update": true } } |
    And I create a profile "test-profile" with the following policies:
    | test-role | [{ "index": "example", "collections": ["one", "two"] }] |
    And I create a user "test-user" with content:
    | profileIds | ["test-profile"] |
    Then I can not delete the profile "test-profile"
    And I can not delete the role "test-role"
    Then I delete the user "test-user"
    And I delete the profile "test-profile"
    And I delete the role "test-role"

  @security
  Scenario: Get multiple users
    Given I create a user "test-user" with content:
    | profileIds | ["default"] |
    And I create a user "test-user2" with content:
    | profileIds | ["default"] |
    When I successfully call the route "security":"mGetUsers" with args:
    | ids | "test-user,test-user2" |
    Then I should receive a "hits" array of objects matching:
    | _id        |
    | "test-user" |
    | "test-user2" |
    When I successfully call the route "security":"mGetUsers" with args:
    | body | {"ids": ["test-user", "test-user2"] } |
    Then I should receive a "hits" array of objects matching:
    | _id          |
    | "test-user"  |
    | "test-user2" |
