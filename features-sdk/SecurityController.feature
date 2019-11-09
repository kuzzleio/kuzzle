Feature: Security Controller

  # security:createApiKey =======================================================

  @security
  Scenario: Create an API key
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
    | hash | "_STRING_" |
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
  Scenario: Search for API keys
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
  Scenario: Delete an API key
    Given I successfully call the route "security":"createApiKey" with args:
    | userId | "test-admin" |
    | _id | "SGN-HCM" |
    | expiresIn | -1 |
    | body | { "description": "My Le Huong" } |
    When I successfully call the route "security":"deleteApiKey" with args:
    | userId | "test-admin" |
    | _id | "SGN-HCM" |
    | refresh | "wait_for" |
    When I successfully call the route "security":"searchApiKeys" with args:
    | userId | "test-admin" |
    Then I should receive a empty "hits" array


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
