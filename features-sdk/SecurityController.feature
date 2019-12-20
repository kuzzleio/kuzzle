Feature: Security Controller

  # security:createApiKey =======================================================

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
  Scenario: Create a role with invalid API rights
    Given I can not create a role "test-role" with the following API rights:
    | invalid-controller | { "actions": { "create": true, "update": true } } |
    And I can not create a role "test-role" with the following API rights:
    | document | { "actions": { "invalid-action": true, "update": true } } |

  @security
  Scenario: Create/get/search/update/delete a role
    Given I am able to find 3 roles by searching controller:
    | controllers | ["document"] |
    Then I create a role "test-role" with the following API rights:
    | document | { "actions": { "create": true, "update": true } } |
    Then I am able to get a role with id "test-role"
    And I am able to find 4 roles by searching controller:
    | controllers | ["document"] |
    And I update the role "test-role" with the following content:
    | document | { "actions": { "create": false, "update": false } } |
    And I delete the role "test-role"
    Then I am able to find 3 roles by searching controller:
    | controllers | ["document"] |
    Then I am not able to get a role with id "test-role"
    Then I create a role "test-role" with the following API rights:
    | document | { "actions": { "create": true, "update": true } } |
    And I create a role "test-role-2" with the following API rights:
    | document | { "actions": { "create": true, "update": true } } |
    And I create a role "test-role-3" with the following API rights:
    | document | { "actions": { "create": true, "update": true } } |
    Then I am able to mGet roles and get 3 roles with the following ids:
    | ids | ["test-role", "test-role-2", "test-role-3"] |
    And I am able to find 6 roles by searching controller:
    | controllers | ["document"] |

  @security
  Scenario: Create/Update a role with invalid plugin API rights
    Given I can not create a role "test-role-plugin" with the following plugin invalid API rights:
    | functional-test-plugin/non-existing-controller | { "actions": { "manage": true } } |
    And I can create a role "test-role-plugin2" with the following plugin invalid API rights:
    | functional-test-plugin/non-existing-controller | { "actions": { "manage": true } } |
    And I can not update a role "test-role-plugin2" with the following plugin invalid API rights:
    | functional-test-plugin/non-existing-controller | { "actions": { "manage": false } } |
    And I can update a role "test-role-plugin2" with the following plugin invalid API rights:
    | functional-test-plugin/non-existing-controller | { "actions": { "manage": false } } |
