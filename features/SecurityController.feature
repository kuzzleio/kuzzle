Feature: Security Controller

  # security:updateRole ========================================================

  @security
  Scenario: Role update should behave like a replace
    Given I "update" a role "default" with the following API rights:
      | auth | { "actions": { "login": true } } |
    Given I "update" a role "default" with the following API rights:
      | document | { "actions": { "create": true } } |
    When I successfully execute the action "security":"getRole" with args:
      | _id | "default" |
    Then I should receive a result matching:
      | _source.controllers.auth | "_UNDEFINED_" |

  # security:refresh ===========================================================

  @security
  Scenario: Refresh a security collection
    Given I successfully execute the action "security":"createRole" with args:
      | _id         | "test-role"                                              |
      | refresh     | false                                                    |
      | body        | { "controllers": { "*": { "actions": { "*": true } } } } |
    # Refresh success on known collection
    When I successfully execute the action "security":"refresh" with args:
      | collection  | "roles"                                                  |
    Then I successfully execute the action "security":"searchRoles"
    And I should receive a "hits" array of objects matching:
      | _id         |
      | "admin"     |
      | "anonymous" |
      | "default"   |
      | "test-role" |
    # Error on unknown collection
    When I execute the action "security":"refresh" with args:
      | collection  | "frontend-security"                                      |
    Then I should receive an error matching:
      | id          | "api.assert.unexpected_argument"                         |

  # security:createApiKey ======================================================

  @security @login
  Scenario: Create an API key for a user
    Given I create a user "My" with content:
      | profileIds | ["default"] |
    When I successfully execute the action "security":"createApiKey" with args:
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
    And I successfully execute the action "security":"searchApiKeys" with args:
      | userId | "My" |
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "My"           | -1          | -1                | "Le Huong"          | "_STRING_"          |

  # security:searchApiKeys =====================================================

  @security
  Scenario: Search for a user API keys
    Given I create a user "My" with content:
      | profileIds | ["default"] |
    And I successfully execute the action "security":"createApiKey" with args:
      | userId    | "My"                          |
      | expiresIn | -1                            |
      | body      | { "description": "Le Huong" } |
    And I successfully execute the action "security":"createApiKey" with args:
      | userId    | "test-admin"                        |
      | expiresIn | -1                                  |
      | body      | { "description": "Sigfox API key" } |
    And I successfully execute the action "security":"createApiKey" with args:
      | userId    | "test-admin"                      |
      | expiresIn | -1                                |
      | body      | { "description": "Lora API key" } |
    And I successfully execute the action "security":"createApiKey" with args:
      | userId    | "test-admin"                        |
      | expiresIn | -1                                  |
      | refresh   | "wait_for"                          |
      | body      | { "description": "Lora API key 2" } |
    When I successfully execute the action "security":"searchApiKeys" with args:
      | userId | "test-admin"                           |
      | body   | { "match": { "description": "Lora" } } |
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "test-admin"   | -1          | -1                | "Lora API key"      | "_STRING_"          |
      | "_STRING_" | "test-admin"   | -1          | -1                | "Lora API key 2"    | "_STRING_"          |
    When I successfully execute the action "security":"searchApiKeys" with args:
      | userId | "My"                             |
      | body   | { "equals": { "userId": "My" } } |
      | lang   | "koncorde"                       |
    Then I should receive a "hits" array of objects matching:
      | _id        | _source.userId | _source.ttl | _source.expiresAt | _source.description | _source.fingerprint |
      | "_STRING_" | "My"           | -1          | -1                | "Le Huong"          | "_STRING_"          |

  # security:deleteApiKey =======================================================

  @security
  Scenario: Delete an API key for an user
    Given I successfully execute the action "security":"createApiKey" with args:
      | userId    | "test-admin"                     |
      | _id       | "SGN-HCM"                        |
      | expiresIn | -1                               |
      | body      | { "description": "My Le Huong" } |
    And I save the created API key
    When I successfully execute the action "security":"deleteApiKey" with args:
      | userId  | "test-admin" |
      | _id     | "SGN-HCM"    |
      | refresh | "wait_for"   |
    And I successfully execute the action "security":"searchApiKeys" with args:
      | userId | "test-admin" |
    Then I should receive a empty "hits" array
    And I can not login with the previously created API key

  # security:createProfile =====================================================

  @security
  Scenario: Create a profile
    Given an index "example"
    And a collection "example":"one"
    Then I try to create a strict profile "test-profile" with the following policies:
      | default | [{ "index": "example", "collections": ["one", "two"] }] |
    And I got an error with id "services.storage.unknown_collection"
    And I am not able to get a profile with id "test-profile"
    Then I try to create a strict profile "test-profile" with the following policies:
      | default | [{ "index": "example2" }] |
    And I got an error with id "services.storage.unknown_index"
    And I am not able to get a profile with id "test-profile"
    Then I create a strict profile "test-profile" with the following policies:
      | default | [{ "index": "example", "collections": ["one"] }] |
    And I am able to get a profile with id "test-profile"
    Then I create a profile "test-profile2" with the following policies:
      | default | [{ "index": "example2", "collections": ["one", "two"] }] |
    And I am able to get a profile with id "test-profile"

  # security:deleteProfile =====================================================

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
  Scenario: Delete a profile and remove it from assigned users
    Given I "create" a role "test-role" with the following API rights:
      | document | { "actions": { "*": true, "*": true } } |
    And I create a profile "base-profile" with the following policies:
      | test-role | [{ "index": "example", "collections": ["one", "two"] }] |
    And I create a profile "to-be-removed-profile" with the following policies:
      | test-role | [{ "index": "example", "collections": ["one", "two"] }] |
    And I create a user "test-user" with content:
      | profileIds | ["base-profile", "to-be-removed-profile"] |
    And I create a user "test-user-two" with content:
      | profileIds | ["to-be-removed-profile"] |
    When I successfully execute the action "security":"deleteProfile" with args:
      | _id             | "to-be-removed-profile" |
      | onAssignedUsers | "remove"                |
      | refresh         | "wait_for"              |
    Then The user "test-user" should have the following profiles:
      | base-profile |
    And The user "test-user-two" should have the following profiles:
      | anonymous |

  # security: createRole, getRole, searchRoles, updateRole, deleteRole =========

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
    When I execute the action "security":"createRole" with args:
      | _id  | "test-role-plugin"                                                                                        |
      | body | { "controllers" :{ "functional-test-plugin/non-existing-controller": {"actions": { "manage": true } } } } |
    Then I should receive an error matching:
      | id | "security.role.unknown_controller" |
    When I successfully execute the action "security":"createRole" with args:
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
    When I successfully execute the action "security":"updateRole" with args:
      | _id   | "test-role-plugin2"                                                                                       |
      | body  | {"controllers" : {"functional-test-plugin/non-existing-controller": {"actions": { "manage": false } } } } |
      | force | true                                                                                                      |
    Then I am able to get a role with id "test-role-plugin2"
    And The property "controllers.functional-test-plugin/non-existing-controller.actions" of the result should match:
      | manage | false |
