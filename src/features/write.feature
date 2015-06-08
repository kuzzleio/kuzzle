Feature: Write feature
  As a user
  I want to write/update/delete a document

  @needCleanDb
  Scenario: Create a new document
    When I write document
    Then I should receive a document id

  @needCleanDb
  Scenario: Update a document
    When I write document
    Then I update the document with value "toto" in field "firstName"
    Then my document has the value "toto" in field "firstName"

  @needCleanDb
  Scenario: Delete a document
    When I write document
    Then I remove the document
    Then I'm not able to get the document