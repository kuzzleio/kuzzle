Feature: Security Controller

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

  @deleteProfile
  Scenario: Delete a profile
    Given I create a role "test-role" with the following policies:
    | document | { "actions":{ "create": true, "update": true }} |
    And I create a profile "test-profile" with the following policies:
    | policies | [ { "roleId": "test-role" } ] |
    Then I delete the profile "test-profile"
    And I delete the role "test-role"

  @deleteProfile
  Scenario: Delete a profile while being assigned to a user
    Given I create a role "test-role" with the following policies:
    | document | { "actions":{ "create": true, "update": true }} |
    And I create a profile "test-profile" with the following policies:
    | policies | [ { "roleId": "test-role" } ] |
    And I create a user "test-user" with content:
    | profileIds | ["test-profile"]|
    Then I can not delete the profile "test-profile"
    And I can not delete the role "test-role"
    Then I delete the user "test-user"
    And I delete the profile "test-profile"
    Then I delete the role "test-role"
