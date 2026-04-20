package handlers

import (
	"context"
	"net/http"
	"time"

	"rpi_guessr/backend/database"
	"rpi_guessr/backend/models"
	"rpi_guessr/backend/storage"

	"github.com/gin-gonic/gin"
)

type GameHandler struct {
	db      *database.PostgresDB
	storage *storage.S3Storage
}

func NewGameHandler(db *database.PostgresDB, storage *storage.S3Storage) *GameHandler {
	return &GameHandler{
		db:      db,
		storage: storage,
	}
}

func (h *GameHandler) CreateGame(c *gin.Context) {
	var req models.CreateGameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Validate mode
	if req.Mode != 5 && req.Mode != 10 && req.Mode != 20 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mode must be 5, 10, or 20"})
		return
	}

	// Validate player name length
	if len(req.PlayerName) < 1 || len(req.PlayerName) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "player name must be 1-50 characters"})
		return
	}

	// Get a random photo for the first round
	photoQuery := `SELECT id, s3_key FROM photos ORDER BY RANDOM() LIMIT 1`
	var photoID, s3Key string
	err := h.db.Pool.QueryRow(context.Background(), photoQuery).Scan(&photoID, &s3Key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no photos available"})
		return
	}

	// Create game with the assigned photo
	query := `
		INSERT INTO games (player_name, mode, current_photo_id, created_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`

	var gameID string
	err = h.db.Pool.QueryRow(context.Background(), query, req.PlayerName, req.Mode, photoID, time.Now()).Scan(&gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create game"})
		return
	}

	c.JSON(http.StatusCreated, models.GameResponse{
		ID:           gameID,
		PlayerName:   req.PlayerName,
		Mode:         req.Mode,
		TotalScore:   0,
		RoundsPlayed: 0,
		Completed:    false,
		CurrentPhoto: &models.RandomPhotoResponse{
			ID:       photoID,
			PhotoURL: h.storage.GetURL(s3Key),
		},
	})
}

func (h *GameHandler) GetGame(c *gin.Context) {
	gameID := c.Param("id")

	query := `
		SELECT g.id, g.player_name, g.mode, g.total_score, g.rounds_played, g.completed,
		       g.created_at, g.completed_at, g.current_photo_id, p.s3_key
		FROM games g
		LEFT JOIN photos p ON g.current_photo_id = p.id
		WHERE g.id = $1
	`

	var game models.Game
	var currentPhotoID, s3Key *string
	err := h.db.Pool.QueryRow(context.Background(), query, gameID).Scan(
		&game.ID, &game.PlayerName, &game.Mode, &game.TotalScore,
		&game.RoundsPlayed, &game.Completed, &game.CreatedAt, &game.CompletedAt,
		&currentPhotoID, &s3Key,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "game not found"})
		return
	}

	response := models.GameResponse{
		ID:           game.ID,
		PlayerName:   game.PlayerName,
		Mode:         game.Mode,
		TotalScore:   game.TotalScore,
		RoundsPlayed: game.RoundsPlayed,
		Completed:    game.Completed,
	}

	// Return the assigned current photo if game is not completed
	if !game.Completed && currentPhotoID != nil && s3Key != nil {
		response.CurrentPhoto = &models.RandomPhotoResponse{
			ID:       *currentPhotoID,
			PhotoURL: h.storage.GetURL(*s3Key),
		}
	}

	c.JSON(http.StatusOK, response)
}

func (h *GameHandler) SubmitGuess(c *gin.Context) {
	gameID := c.Param("id")

	var req models.GameGuessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Get game info including current_photo_id
	gameQuery := `SELECT mode, total_score, rounds_played, completed, current_photo_id FROM games WHERE id = $1`
	var mode, totalScore, roundsPlayed int
	var completed bool
	var currentPhotoID *string
	err := h.db.Pool.QueryRow(context.Background(), gameQuery, gameID).Scan(&mode, &totalScore, &roundsPlayed, &completed, &currentPhotoID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "game not found"})
		return
	}

	if completed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "game already completed"})
		return
	}

	// Validate that the submitted photo_id matches the assigned current photo
	if currentPhotoID == nil || req.PhotoID != *currentPhotoID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid photo for current round"})
		return
	}

	// Get actual photo location
	photoQuery := `SELECT longitude, latitude FROM photos WHERE id = $1`
	var actualLon, actualLat float64
	err = h.db.Pool.QueryRow(context.Background(), photoQuery, req.PhotoID).Scan(&actualLon, &actualLat)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
		return
	}

	// Calculate distance and points
	distanceKm := haversineDistance(req.Latitude, req.Longitude, actualLat, actualLon)
	points := CalculatePoints(distanceKm)

	// Update game state
	roundsPlayed++
	totalScore += points
	gameCompleted := roundsPlayed >= mode

	// Insert guess
	guessQuery := `
		INSERT INTO guesses (photo_id, game_id, guess_longitude, guess_latitude, distance_km, points, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = h.db.Pool.Exec(context.Background(), guessQuery,
		req.PhotoID, gameID, req.Longitude, req.Latitude, distanceKm, points, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save guess"})
		return
	}

	// Update game with new state and next photo
	if gameCompleted {
		updateQuery := `UPDATE games SET total_score = $1, rounds_played = $2, completed = true, completed_at = $3, current_photo_id = NULL WHERE id = $4`
		_, err = h.db.Pool.Exec(context.Background(), updateQuery, totalScore, roundsPlayed, time.Now(), gameID)
	} else {
		// Get next photo (excluding already guessed photos)
		nextPhotoQuery := `
			SELECT id FROM photos
			WHERE id NOT IN (SELECT photo_id FROM guesses WHERE game_id = $1)
			ORDER BY RANDOM() LIMIT 1
		`
		var nextPhotoID string
		err = h.db.Pool.QueryRow(context.Background(), nextPhotoQuery, gameID).Scan(&nextPhotoID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no more photos available"})
			return
		}

		updateQuery := `UPDATE games SET total_score = $1, rounds_played = $2, current_photo_id = $3 WHERE id = $4`
		_, err = h.db.Pool.Exec(context.Background(), updateQuery, totalScore, roundsPlayed, nextPhotoID, gameID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update game"})
		return
	}

	response := models.GameGuessResponse{
		DistanceKm:    distanceKm,
		Points:        points,
		TotalScore:    totalScore,
		RoundsPlayed:  roundsPlayed,
		GameCompleted: gameCompleted,
	}
	response.ActualLocation.Longitude = actualLon
	response.ActualLocation.Latitude = actualLat

	c.JSON(http.StatusOK, response)
}

func (h *GameHandler) GetLeaderboard(c *gin.Context) {
	modeStr := c.DefaultQuery("mode", "5")
	period := c.DefaultQuery("period", "7d")

	var mode int
	switch modeStr {
	case "5":
		mode = 5
	case "10":
		mode = 10
	case "20":
		mode = 20
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "mode must be 5, 10, or 20"})
		return
	}

	// Calculate time filter
	var timeFilter time.Time
	switch period {
	case "1d":
		timeFilter = time.Now().AddDate(0, 0, -1)
	case "3d":
		timeFilter = time.Now().AddDate(0, 0, -3)
	case "7d":
		timeFilter = time.Now().AddDate(0, 0, -7)
	case "all":
		timeFilter = time.Time{} // Zero time means no filter
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "period must be 1d, 3d, 7d, or all"})
		return
	}

	var query string
	var args []interface{}

	if timeFilter.IsZero() {
		query = `
			SELECT id, player_name, total_score, completed_at
			FROM games
			WHERE mode = $1 AND completed = true
			ORDER BY total_score DESC
			LIMIT 50
		`
		args = []interface{}{mode}
	} else {
		query = `
			SELECT id, player_name, total_score, completed_at
			FROM games
			WHERE mode = $1 AND completed = true AND completed_at >= $2
			ORDER BY total_score DESC
			LIMIT 50
		`
		args = []interface{}{mode, timeFilter}
	}

	rows, err := h.db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch leaderboard"})
		return
	}
	defer rows.Close()

	var entries []models.LeaderboardEntry
	rank := 1

	for rows.Next() {
		var entry models.LeaderboardEntry
		if err := rows.Scan(&entry.GameID, &entry.PlayerName, &entry.TotalScore, &entry.CompletedAt); err != nil {
			continue
		}
		entry.Rank = rank
		entries = append(entries, entry)
		rank++
	}

	if entries == nil {
		entries = []models.LeaderboardEntry{}
	}

	c.JSON(http.StatusOK, models.LeaderboardResponse{
		Mode:    mode,
		Period:  period,
		Entries: entries,
	})
}

func (h *GameHandler) GetGameDetails(c *gin.Context) {
	gameID := c.Param("id")

	// Get game info
	gameQuery := `
		SELECT id, player_name, mode, total_score, completed_at
		FROM games
		WHERE id = $1 AND completed = true
	`

	var response models.GameDetailsResponse
	err := h.db.Pool.QueryRow(context.Background(), gameQuery, gameID).Scan(
		&response.ID, &response.PlayerName, &response.Mode, &response.TotalScore, &response.CompletedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "game not found"})
		return
	}

	// Get all guesses for this game with photo info
	guessQuery := `
		SELECT p.id, p.s3_key, g.guess_longitude, g.guess_latitude,
		       p.longitude, p.latitude, g.distance_km, g.points
		FROM guesses g
		JOIN photos p ON g.photo_id = p.id
		WHERE g.game_id = $1
		ORDER BY g.created_at ASC
	`

	rows, err := h.db.Pool.Query(context.Background(), guessQuery, gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch game rounds"})
		return
	}
	defer rows.Close()

	round := 1
	for rows.Next() {
		var r models.GameRound
		var s3Key string
		if err := rows.Scan(&r.PhotoID, &s3Key, &r.GuessLongitude, &r.GuessLatitude,
			&r.ActualLongitude, &r.ActualLatitude, &r.DistanceKm, &r.Points); err != nil {
			continue
		}
		r.Round = round
		r.PhotoURL = h.storage.GetURL(s3Key)
		response.Rounds = append(response.Rounds, r)
		round++
	}

	if response.Rounds == nil {
		response.Rounds = []models.GameRound{}
	}

	c.JSON(http.StatusOK, response)
}

// Admin handlers

func (h *GameHandler) ListGames(c *gin.Context) {
	query := `
		SELECT id, player_name, mode, total_score, rounds_played, completed, created_at, completed_at
		FROM games
		WHERE completed = true
		ORDER BY completed_at DESC
		LIMIT 200
	`

	rows, err := h.db.Pool.Query(context.Background(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch games"})
		return
	}
	defer rows.Close()

	var games []models.Game
	for rows.Next() {
		var game models.Game
		if err := rows.Scan(&game.ID, &game.PlayerName, &game.Mode, &game.TotalScore,
			&game.RoundsPlayed, &game.Completed, &game.CreatedAt, &game.CompletedAt); err != nil {
			continue
		}
		games = append(games, game)
	}

	if games == nil {
		games = []models.Game{}
	}

	c.JSON(http.StatusOK, games)
}

func (h *GameHandler) UpdateGame(c *gin.Context) {
	gameID := c.Param("id")

	var req struct {
		PlayerName string `json:"player_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if len(req.PlayerName) < 1 || len(req.PlayerName) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "player name must be 1-50 characters"})
		return
	}

	query := `UPDATE games SET player_name = $1 WHERE id = $2`
	result, err := h.db.Pool.Exec(context.Background(), query, req.PlayerName, gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update game"})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "game not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Game updated"})
}

func (h *GameHandler) DeleteGame(c *gin.Context) {
	gameID := c.Param("id")

	// Delete guesses first (should cascade, but being explicit)
	_, _ = h.db.Pool.Exec(context.Background(), `DELETE FROM guesses WHERE game_id = $1`, gameID)

	// Delete game
	query := `DELETE FROM games WHERE id = $1`
	result, err := h.db.Pool.Exec(context.Background(), query, gameID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete game"})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "game not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Game deleted"})
}
