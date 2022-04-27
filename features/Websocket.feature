Feature: WebSocket

  # WebSocket ===========================================================
  @websocket
  Scenario: Check reponse message from Kuzzle with a specific payload
    Given I open a new local websocket connection
    When I send the message '{"p":1}' to Kuzzle through websocket
    And I wait to receive a websocket response from Kuzzle
    Then I should receive a response message from Kuzzle through websocket matching:
      |  p  |  2  |

  @websocket
  Scenario: Check no default headers in body and verify no leakage of set-cookie
    Given I open a new local websocket connection
    When I send the message '{"controller":"tests","action":"sendBodyHeaders"}' to Kuzzle through websocket
    And I wait to receive a websocket response from Kuzzle
    Then The response headers in the body should be equal:
      | foo   | "bar"  |
      | alpha | "beta" |