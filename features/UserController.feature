Feature: User Controller

  @security
  Scenario: Create a new user
    Given I successfully execute the action "user":"create" with args:
      | _id  | "alyx"                                       |
      | body | { "content": { "profileIds": ["default"] } } |
    Then I should receive a result matching:
      | _id                | "alyx"      |
      | _source.profileIds | ["default"] |