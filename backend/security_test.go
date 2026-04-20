package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

const baseURL = "http://localhost:8080"

// TestMain starts the docker containers before tests and stops them after
func TestMain(m *testing.M) {
	// Start containers
	fmt.Println("Starting docker containers...")
	cmd := exec.Command("docker", "compose", "-f", "docker-compose.local.yml", "up", "-d", "--build")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Printf("Failed to start containers: %v\n", err)
		os.Exit(1)
	}

	// Wait for server to be ready
	fmt.Println("Waiting for server to be ready...")
	ready := false
	for i := 0; i < 30; i++ {
		resp, err := http.Get(baseURL + "/health")
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			ready = true
			break
		}
		time.Sleep(time.Second)
	}

	if !ready {
		fmt.Println("Server failed to start")
		exec.Command("docker", "compose", "-f", "docker-compose.local.yml", "down").Run()
		os.Exit(1)
	}

	fmt.Println("Server is ready, running tests...")

	// Run tests
	code := m.Run()

	// Stop containers
	fmt.Println("Stopping docker containers...")
	exec.Command("docker", "compose", "-f", "docker-compose.local.yml", "down").Run()

	os.Exit(code)
}

// Helper to make JSON requests
func jsonRequest(method, url string, body interface{}) (*http.Response, []byte, error) {
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, nil, err
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	return resp, respBody, err
}

// createGame creates a new game and returns game ID and first photo ID
func createGame(t *testing.T, playerName string, mode int) (gameID, photoID string) {
	resp, body, err := jsonRequest("POST", baseURL+"/api/games", map[string]interface{}{
		"player_name": playerName,
		"mode":        mode,
	})
	if err != nil {
		t.Fatalf("Failed to create game: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected 201, got %d: %s", resp.StatusCode, body)
	}

	var result struct {
		ID           string `json:"id"`
		CurrentPhoto struct {
			ID string `json:"id"`
		} `json:"current_photo"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	return result.ID, result.CurrentPhoto.ID
}

// =============================================================================
// EXPLOIT TESTS
// =============================================================================

// TestExploit_PhotoIDManipulation tests that players cannot submit guesses for
// photos other than the one assigned to their current round
func TestExploit_PhotoIDManipulation(t *testing.T) {
	// Create two games to get two different photo IDs
	gameID1, photoID1 := createGame(t, "player1", 5)
	_, photoID2 := createGame(t, "player2", 5)

	// If both games got the same photo, skip this test
	if photoID1 == photoID2 {
		t.Skip("Both games got the same photo, cannot test photo manipulation")
	}

	// Try to submit a guess for game1 using photoID2 (wrong photo)
	resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID1+"/guess", map[string]interface{}{
		"photo_id":  photoID2, // Wrong photo!
		"latitude":  42.7300,
		"longitude": -73.6800,
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	// This should be rejected
	if resp.StatusCode == http.StatusOK {
		t.Errorf("EXPLOIT SUCCEEDED: Server accepted guess for wrong photo! Response: %s", body)
	} else if resp.StatusCode == http.StatusBadRequest {
		t.Logf("Exploit correctly blocked: %s", body)
	} else {
		t.Logf("Unexpected status %d: %s", resp.StatusCode, body)
	}
}

// TestExploit_ReplayingSamePhoto tests that players cannot submit the same
// photo_id multiple times to get easy points
func TestExploit_ReplayingSamePhoto(t *testing.T) {
	gameID, photoID := createGame(t, "replay_test", 5)

	// Submit first guess (should succeed)
	resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
		"photo_id":  photoID,
		"latitude":  42.7300,
		"longitude": -73.6800,
	})
	if err != nil {
		t.Fatalf("First guess failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("First guess should succeed, got %d: %s", resp.StatusCode, body)
	}

	// Try to submit the same photo again (should fail)
	resp, body, err = jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
		"photo_id":  photoID, // Same photo again
		"latitude":  42.7300,
		"longitude": -73.6800,
	})
	if err != nil {
		t.Fatalf("Second guess request failed: %v", err)
	}

	if resp.StatusCode == http.StatusOK {
		t.Errorf("EXPLOIT SUCCEEDED: Server accepted same photo twice! Response: %s", body)
	} else {
		t.Logf("Replay correctly blocked with status %d: %s", resp.StatusCode, body)
	}
}

// TestExploit_FakePhotoID tests that players cannot use made-up photo IDs
func TestExploit_FakePhotoID(t *testing.T) {
	gameID, _ := createGame(t, "fake_photo_test", 5)

	// Try to submit a guess with a fake photo ID
	resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
		"photo_id":  "00000000-0000-0000-0000-000000000000",
		"latitude":  42.7300,
		"longitude": -73.6800,
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode == http.StatusOK {
		t.Errorf("EXPLOIT SUCCEEDED: Server accepted fake photo ID! Response: %s", body)
	} else {
		t.Logf("Fake photo ID correctly rejected with status %d: %s", resp.StatusCode, body)
	}
}

// =============================================================================
// SQL INJECTION TESTS
// =============================================================================

// TestSQLInjection_PlayerName tests SQL injection via player name
func TestSQLInjection_PlayerName(t *testing.T) {
	injectionPayloads := []string{
		"'; DROP TABLE games; --",
		"' OR '1'='1",
		"admin'--",
		"'; DELETE FROM photos; --",
		"' UNION SELECT * FROM photos --",
		"Robert'); DROP TABLE games;--",
		"1; UPDATE games SET total_score=99999 WHERE '1'='1",
	}

	for _, payload := range injectionPayloads {
		t.Run(payload, func(t *testing.T) {
			resp, body, err := jsonRequest("POST", baseURL+"/api/games", map[string]interface{}{
				"player_name": payload,
				"mode":        5,
			})
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			// Should either succeed (payload treated as literal string) or fail validation
			// Should NOT cause a server error (500)
			if resp.StatusCode == http.StatusInternalServerError {
				t.Errorf("SQL injection may have caused server error: %s", body)
			}

			// Verify games table still exists by creating a normal game
			resp2, _, err := jsonRequest("POST", baseURL+"/api/games", map[string]interface{}{
				"player_name": "verify_tables_exist",
				"mode":        5,
			})
			if err != nil || resp2.StatusCode != http.StatusCreated {
				t.Errorf("SQL injection may have damaged database!")
			}
		})
	}
}

// TestSQLInjection_GameID tests SQL injection via game ID parameter
func TestSQLInjection_GameID(t *testing.T) {
	injectionPayloads := []string{
		"' OR '1'='1",
		"'; DROP TABLE games; --",
		"1 UNION SELECT * FROM photos",
		"00000000-0000-0000-0000-000000000000' OR '1'='1",
	}

	for _, payload := range injectionPayloads {
		t.Run(payload, func(t *testing.T) {
			resp, body, err := jsonRequest("GET", baseURL+"/api/games/"+payload, nil)
			if err != nil {
				// URL encoding issues are expected for some payloads
				return
			}

			if resp.StatusCode == http.StatusInternalServerError {
				t.Errorf("SQL injection may have caused server error: %s", body)
			}

			// Should return 404 for invalid game IDs, not leak data
			if resp.StatusCode == http.StatusOK {
				var result map[string]interface{}
				json.Unmarshal(body, &result)
				t.Logf("Response for injection: %v", result)
			}
		})
	}
}

// TestSQLInjection_PhotoID tests SQL injection via photo_id in guess
func TestSQLInjection_PhotoID(t *testing.T) {
	gameID, _ := createGame(t, "sqli_photo_test", 5)

	injectionPayloads := []string{
		"' OR '1'='1",
		"'; UPDATE photos SET latitude=0; --",
		"1' UNION SELECT longitude, latitude FROM photos --",
	}

	for _, payload := range injectionPayloads {
		t.Run(payload, func(t *testing.T) {
			resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
				"photo_id":  payload,
				"latitude":  42.7300,
				"longitude": -73.6800,
			})
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			if resp.StatusCode == http.StatusInternalServerError {
				t.Errorf("SQL injection may have caused server error: %s", body)
			}
		})
	}
}

// TestSQLInjection_Coordinates tests SQL injection via latitude/longitude
func TestSQLInjection_Coordinates(t *testing.T) {
	gameID, photoID := createGame(t, "sqli_coords_test", 5)

	// These will likely fail JSON parsing, but let's test raw requests too
	// For JSON, numbers can't contain SQL - but let's verify extreme values
	extremeValues := []float64{
		-999999999999,
		999999999999,
		0,
		-0,
	}

	for _, val := range extremeValues {
		resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
			"photo_id":  photoID,
			"latitude":  val,
			"longitude": val,
		})
		if err != nil {
			continue
		}

		if resp.StatusCode == http.StatusInternalServerError {
			t.Errorf("Extreme coordinate value caused server error: %s", body)
		}
	}
}

// =============================================================================
// OTHER SECURITY TESTS
// =============================================================================

// TestExploit_AccessOtherPlayersGame tests that game IDs aren't enumerable
func TestExploit_AccessOtherPlayersGame(t *testing.T) {
	// Create a game
	gameID, photoID := createGame(t, "victim", 5)

	// An attacker who guesses the game ID could submit guesses
	// This tests that even if they know the ID, they need the right photo
	resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
		"photo_id":  "00000000-0000-0000-0000-000000000000", // Wrong photo
		"latitude":  42.7300,
		"longitude": -73.6800,
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode == http.StatusOK {
		t.Errorf("Attacker could submit guess without knowing correct photo! Response: %s", body)
	}

	// But with the correct photo ID, it should work (this is expected behavior)
	resp, body, err = jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
		"photo_id":  photoID,
		"latitude":  42.7300,
		"longitude": -73.6800,
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Legitimate guess should work, got %d: %s", resp.StatusCode, body)
	}
}

// TestExploit_NegativeMode tests creating games with invalid modes
func TestExploit_NegativeMode(t *testing.T) {
	invalidModes := []int{-1, 0, 1, 3, 15, 100, 999999}

	for _, mode := range invalidModes {
		t.Run(fmt.Sprintf("mode_%d", mode), func(t *testing.T) {
			resp, body, err := jsonRequest("POST", baseURL+"/api/games", map[string]interface{}{
				"player_name": "mode_test",
				"mode":        mode,
			})
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			if resp.StatusCode == http.StatusCreated {
				t.Errorf("Server accepted invalid mode %d: %s", mode, body)
			}
		})
	}
}

// TestExploit_ExtremeCoordinates tests submitting extreme coordinate values
func TestExploit_ExtremeCoordinates(t *testing.T) {
	gameID, photoID := createGame(t, "extreme_coords", 5)

	testCases := []struct {
		name string
		lat  float64
		lon  float64
	}{
		{"max_values", 90, 180},
		{"min_values", -90, -180},
		{"over_max_lat", 91, 0},
		{"under_min_lat", -91, 0},
		{"over_max_lon", 0, 181},
		{"under_min_lon", 0, -181},
		{"huge_values", 99999, 99999},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
				"photo_id":  photoID,
				"latitude":  tc.lat,
				"longitude": tc.lon,
			})
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			// Should not cause server error
			if resp.StatusCode == http.StatusInternalServerError {
				t.Errorf("Extreme coordinates caused server error: %s", body)
			}
		})
	}
}

// TestExploit_LongPlayerName tests buffer overflow via long player names
func TestExploit_LongPlayerName(t *testing.T) {
	longNames := []string{
		strings.Repeat("A", 51),    // Just over limit
		strings.Repeat("A", 100),   // 2x limit
		strings.Repeat("A", 1000),  // Very long
		strings.Repeat("A", 10000), // Extremely long
	}

	for i, name := range longNames {
		t.Run(fmt.Sprintf("len_%d", len(name)), func(t *testing.T) {
			resp, body, err := jsonRequest("POST", baseURL+"/api/games", map[string]interface{}{
				"player_name": name,
				"mode":        5,
			})
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			if resp.StatusCode == http.StatusCreated {
				t.Errorf("Server accepted player name of length %d: %s", len(longNames[i]), body)
			}
			if resp.StatusCode == http.StatusInternalServerError {
				t.Errorf("Long player name caused server error: %s", body)
			}
		})
	}
}

// TestExploit_CompletedGameGuess tests submitting guesses to completed games
func TestExploit_CompletedGameGuess(t *testing.T) {
	// Create a 5-round game and complete it
	gameID, photoID := createGame(t, "complete_test", 5)

	// Complete all 5 rounds
	for i := 0; i < 5; i++ {
		// Get current photo
		resp, body, err := jsonRequest("GET", baseURL+"/api/games/"+gameID, nil)
		if err != nil {
			t.Fatalf("Failed to get game: %v", err)
		}

		var game struct {
			Completed    bool `json:"completed"`
			CurrentPhoto *struct {
				ID string `json:"id"`
			} `json:"current_photo"`
		}
		json.Unmarshal(body, &game)

		if game.Completed {
			break
		}
		if game.CurrentPhoto == nil {
			t.Fatalf("No current photo for round %d", i+1)
		}

		// Submit guess
		resp, body, err = jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
			"photo_id":  game.CurrentPhoto.ID,
			"latitude":  42.7300,
			"longitude": -73.6800,
		})
		if err != nil {
			t.Fatalf("Guess failed: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Guess should succeed, got %d: %s", resp.StatusCode, body)
		}
	}

	// Now try to submit another guess to the completed game
	resp, body, err := jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
		"photo_id":  photoID,
		"latitude":  42.7300,
		"longitude": -73.6800,
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode == http.StatusOK {
		t.Errorf("EXPLOIT: Server accepted guess for completed game! Response: %s", body)
	} else {
		t.Logf("Completed game guess correctly rejected: %s", body)
	}
}

// TestExploit_MissingFields tests requests with missing required fields
func TestExploit_MissingFields(t *testing.T) {
	// Create game without player_name
	resp, body, err := jsonRequest("POST", baseURL+"/api/games", map[string]interface{}{
		"mode": 5,
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	if resp.StatusCode == http.StatusCreated {
		t.Errorf("Server created game without player_name: %s", body)
	}

	// Create game without mode
	resp, body, err = jsonRequest("POST", baseURL+"/api/games", map[string]interface{}{
		"player_name": "test",
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	if resp.StatusCode == http.StatusCreated {
		t.Errorf("Server created game without mode: %s", body)
	}

	// Guess without photo_id
	gameID, _ := createGame(t, "missing_field_test", 5)
	resp, body, err = jsonRequest("POST", baseURL+"/api/games/"+gameID+"/guess", map[string]interface{}{
		"latitude":  42.73,
		"longitude": -73.68,
	})
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	if resp.StatusCode == http.StatusOK {
		t.Errorf("Server accepted guess without photo_id: %s", body)
	}
}

// TestExploit_LeaderboardManipulation tests that leaderboard can't be manipulated
func TestExploit_LeaderboardManipulation(t *testing.T) {
	// Try invalid period values
	invalidPeriods := []string{"0d", "-1d", "999d", "'; DROP TABLE games; --", "all; DROP TABLE games"}

	for _, period := range invalidPeriods {
		t.Run(period, func(t *testing.T) {
			resp, body, err := jsonRequest("GET", baseURL+"/api/leaderboard?mode=5&period="+period, nil)
			if err != nil {
				return // URL encoding issues expected
			}

			if resp.StatusCode == http.StatusInternalServerError {
				t.Errorf("Invalid period caused server error: %s", body)
			}
		})
	}
}
