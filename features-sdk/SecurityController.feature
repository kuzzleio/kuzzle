Feature: Security Controller

  # security:refresh ===========================================================

  @security
  Scenario: Refresh a security collection
    Given I successfully call the action "security":"createUser" with args:
      | _id     | "aschen"                                     |
      | refresh | false                                        |
      | body    | { "content": { "profileIds": ["default"] } } |
    # Refresh success on known collection
    When I successfully call the action "security":"refresh" with args:
      | collection | "users" |
    Then I successfully call the action "security":"searchUsers"
    And I should receive a "hits" array of objects matching:
      | _id          |
      | "test-admin" |
      | "aschen"     |
    # Error on unknown collection
    When I call the action "security":"refresh" with args:
      | collection | "frontend-security" |
    Then I should receive an error matching:
      | id | "api.assert.unexpected_argument" |

  # security:createApiKey ======================================================

  @security @login
  Scenario: Create an API key for an user
    Given I create a user "My" with content:
      | profileIds | ["default"] |
    When I successfully call the action "security":"createApiKey" with args:
      | userId    | "My"                          |
      | expiresIn | -1                            |
      | refresh   | "wait_for"                    |
      | body      | { "description": "Le Huong" } |
    Then The property "_source" of the result should match:
      | expiresAt   | -1         |
      | ttl         | -1         |
      | description | "Le Huong" |
      | token       | "_STRING_" |
    And The result should contain a property "_id" of type "string"
    And I can login with the previously created API key
    And I successfully call the action "security":"searchApiKeys" with args:
      | userId | "My" |
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "My"           | -1          | -1                | "Le Huong"          | "_STRING_"   |

  # security:searchApiKeys =====================================================

  @security
  Scenario: Search for an user API keys
    Given I create a user "My" with content:
      | profileIds | ["default"] |
    And I successfully call the action "security":"createApiKey" with args:
      | userId    | "My"                          |
      | expiresIn | -1                            |
      | body      | { "description": "Le Huong" } |
    And I successfully call the action "security":"createApiKey" with args:
      | userId    | "test-admin"                        |
      | expiresIn | -1                                  |
      | body      | { "description": "Sigfox API key" } |
    And I successfully call the action "security":"createApiKey" with args:
      | userId    | "test-admin"                      |
      | expiresIn | -1                                |
      | body      | { "description": "Lora API key" } |
    And I successfully call the action "security":"createApiKey" with args:
      | userId    | "test-admin"                        |
      | expiresIn | -1                                  |
      | refresh   | "wait_for"                          |
      | body      | { "description": "Lora API key 2" } |
    When I successfully call the action "security":"searchApiKeys" with args:
      | userId | "test-admin"                           |
      | body   | { "match": { "description": "Lora" } } |
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "test-admin"   | -1          | -1                | "Lora API key"      | "_STRING_"   |
      | "_STRING_" | "test-admin"   | -1          | -1                | "Lora API key 2"    | "_STRING_"   |

  # security:deleteApiKey =======================================================

  @security
  Scenario: Delete an API key for an user
    Given I successfully call the action "security":"createApiKey" with args:
      | userId    | "test-admin"                     |
      | _id       | "SGN-HCM"                        |
      | expiresIn | -1                               |
      | body      | { "description": "My Le Huong" } |
    And I save the created API key
    When I successfully call the action "security":"deleteApiKey" with args:
      | userId  | "test-admin" |
      | _id     | "SGN-HCM"    |
      | refresh | "wait_for"   |
    And I successfully call the action "security":"searchApiKeys" with args:
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
    When I successfully call the action "security":"createFirstAdmin" with args:
      | _id  | "first-admin"                                                                                        |
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
    When I successfully call the action "security":"createFirstAdmin" with args:
      | _id   | "first-admin"                                                                                        |
      | body  | { "credentials": { "local": { "username": "first-admin", "password": "password" } }, "content": {} } |
      | reset | true                                                                                                 |
    Then I should receive a result matching:
      | _source | { "profileIds": ["admin"] } |
    And I'm logged in Kuzzle as user "first-admin" with password "password"
    # Test of roles reset
    And The role "anonymous" should match the default one
    And The role "default" should match the default one

  Scenario: Delete a profile
    Given I "create" a role "test-role" with the following API rights:
      | document | { "actions": { "create": true, "update": true } } |
    And I create a profile "test-profile" with the following policies:
      | test-role | [{ "index": "example", "collections": ["one", "two"] }] |
    Then I delete the profile "test-profile"
    And I delete the role "test-role"

  Scenario: Delete a profile while being assigned to a user
    Given I "create" a role "test-role" with the following API rights:
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
    When I can not "create" a role "test-role" with the following API rights:
      | invalid-controller | { "actions": { "create": true, "update": true } } |
    Then I should receive an error matching:
      | id | "security.role.unknown_controller" |
    And I can not "create" a role "test-role" with the following API rights:
      | document | { "actions": { "invalid_action": true, "update": true } } |
    Then I should receive an error matching:
      | id | "security.role.unknown_action" |

  @security
  Scenario: Create/get/search/update/delete a role
    Given I am able to find 3 roles by searching controller:
      | controllers | ["document"] |
    When I "create" a role "test-role" with the following API rights:
      | document | { "actions": { "create": true, "update": true } } |
    Then I am able to get a role with id "test-role"
    And The property "controllers.document.actions" of the result should match:
      | create | true |
      | update | true |
    And I am able to find 4 roles by searching controller:
      | controllers | ["document"] |
    When I "update" a role "test-role" with the following API rights:
      | document | { "actions": { "create": false, "update": false } } |
    Then I am able to get a role with id "test-role"
    And The property "controllers.document.actions" of the result should match:
      | create | false |
      | update | false |
    When I delete the role "test-role"
    Then I am able to find 3 roles by searching controller:
      | controllers | ["document"] |
    And I am not able to get a role with id "test-role"
    Given I "create" a role "test-role" with the following API rights:
      | document | { "actions": { "create": true, "update": true } } |
    And I "create" a role "test-role-2" with the following API rights:
      | document | { "actions": { "create": true, "update": true } } |
    And I "create" a role "test-role-3" with the following API rights:
      | document | { "actions": { "create": true, "update": true } } |
    When I am able to mGet roles and get 3 roles with the following ids:
      | ids | ["test-role", "test-role-2", "test-role-3"] |
    Then I should receive a array of objects matching:
      | _id           |
      | "test-role"   |
      | "test-role-2" |
      | "test-role-3" |
    And I am able to find 6 roles by searching controller:
      | controllers | ["document"] |
    And I should receive a "hits" array of objects matching:
      | _id           |
      | "admin"       |
      | "anonymous"   |
      | "default"     |
      | "test-role"   |
      | "test-role-2" |
      | "test-role-3" |
    And I am able to find 3 roles by searching controller:
      | controllers | ["document", "auth", "security"] |
    And I should receive a "hits" array of objects matching:
      | _id           |
      | "admin"       |
      | "anonymous"   |
      | "default"     |
      | "test-role"   |
      | "test-role-2" |
      | "test-role-3" |

  @security
  Scenario: Create/Update a role with invalid plugin API rights
    When I call the action "security":"createRole" with args:
      | _id  | "test-role-plugin"                                                                                        |
      | body | { "controllers" :{ "functional-test-plugin/non-existing-controller": {"actions": { "manage": true } } } } |
    Then I should receive an error matching:
      | id | "security.role.unknown_controller" |
    When I successfully call the action "security":"createRole" with args:
      | _id   | "test-role-plugin2"                                                                                       |
      | body  | { "controllers" :{ "functional-test-plugin/non-existing-controller": {"actions": { "manage": true } } } } |
      | force | true                                                                                                      |
    Then I am able to find 1 roles by searching controller:
      | controllers | ["functional-test-plugin/non-existing-controller"] |
    And I should receive a "hits" array of objects matching:
      | _id                 |
      | "admin"             |
      | "anonymous"         |
      | "default"           |
      | "test-role-plugin2" |
    When I can not "update" a role "test-role-plugin2" with the following API rights:
      | functional-test-plugin/non-existing-controller | { "actions": { "manage": false } } |
    Then I should receive an error matching:
      | id | "security.role.unknown_controller" |
    When I successfully call the action "security":"updateRole" with args:
      | _id   | "test-role-plugin2"                                                                                       |
      | body  | {"controllers" : {"functional-test-plugin/non-existing-controller": {"actions": { "manage": false } } } } |
      | force | true                                                                                                      |
    Then I am able to get a role with id "test-role-plugin2"
    And The property "_source.controllers.functional-test-plugin/non-existing-controller.actions" of the result should match:
      | manage | false |

  Scenario: Get multiple users
    Given I create a user "test-user" with content:
      | profileIds | ["default"] |
    And I create a user "test-user2" with content:
      | profileIds | ["default"] |
    When I successfully call the action "security":"mGetUsers" with args:
      | ids | "test-user,test-user2" |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |
    When I successfully call the action "security":"mGetUsers" with args:
      | body | {"ids": ["test-user", "test-user2"] } |
    Then I should receive a "hits" array of objects matching:
      | _id          |
      | "test-user"  |
      | "test-user2" |

