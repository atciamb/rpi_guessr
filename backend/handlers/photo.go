package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"

	"rpi_guessr/backend/database"
	"rpi_guessr/backend/models"
	"rpi_guessr/backend/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rwcarlsen/goexif/exif"
)

const earthRadiusKm = 6371.0

func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLon := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}

type PhotoHandler struct {
	db      *database.PostgresDB
	storage *storage.S3Storage
}

func NewPhotoHandler(db *database.PostgresDB, storage *storage.S3Storage) *PhotoHandler {
	return &PhotoHandler{
		db:      db,
		storage: storage,
	}
}

func (h *PhotoHandler) GetRandomPhoto(c *gin.Context) {
	query := `SELECT id, s3_key FROM photos ORDER BY RANDOM() LIMIT 1`

	var photoID, s3Key string
	err := h.db.Pool.QueryRow(context.Background(), query).Scan(&photoID, &s3Key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No photos found"})
		return
	}

	c.JSON(http.StatusOK, models.RandomPhotoResponse{
		ID:       photoID,
		PhotoURL: h.storage.GetURL(s3Key),
	})
}

func (h *PhotoHandler) GetPhotoInfo(c *gin.Context) {
	photoID := c.Param("id")

	query := `
		SELECT id, longitude, latitude, created_at
		FROM photos
		WHERE id = $1
	`

	var photo models.PhotoInfoResponse
	err := h.db.Pool.QueryRow(context.Background(), query, photoID).Scan(
		&photo.ID,
		&photo.Longitude,
		&photo.Latitude,
		&photo.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Photo not found"})
		return
	}

	c.JSON(http.StatusOK, photo)
}

func (h *PhotoHandler) UploadPhoto(c *gin.Context) {
	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo file is required"})
		return
	}
	defer file.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read photo"})
		return
	}
	fileBytes := buf.Bytes()

	exifData, err := exif.Decode(bytes.NewReader(fileBytes))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read photo metadata"})
		return
	}

	lat, lon, err := exifData.LatLong()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo does not contain GPS location data"})
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	s3Key := fmt.Sprintf("photos/%s-%s", uuid.New().String(), header.Filename)

	err = h.storage.Upload(c.Request.Context(), s3Key, bytes.NewReader(fileBytes), contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload photo"})
		return
	}

	query := `
		INSERT INTO photos (s3_key, s3_bucket, longitude, latitude, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	var photoID string
	now := time.Now()
	err = h.db.Pool.QueryRow(
		context.Background(),
		query,
		s3Key,
		h.storage.Bucket(),
		lon,
		lat,
		now,
		now,
	).Scan(&photoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save photo metadata"})
		return
	}

	c.JSON(http.StatusCreated, models.RandomPhotoResponse{
		ID:       photoID,
		PhotoURL: h.storage.GetURL(s3Key),
	})
}

func (h *PhotoHandler) SubmitGuess(c *gin.Context) {
	photoID := c.Param("id")

	var req models.GuessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	query := `SELECT longitude, latitude FROM photos WHERE id = $1`

	var actualLon, actualLat float64
	err := h.db.Pool.QueryRow(context.Background(), query, photoID).Scan(&actualLon, &actualLat)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Photo not found"})
		return
	}

	distanceKm := haversineDistance(req.Latitude, req.Longitude, actualLat, actualLon)

	// Store the guess in the database
	insertQuery := `
		INSERT INTO guesses (photo_id, guess_longitude, guess_latitude, distance_km, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err = h.db.Pool.Exec(context.Background(), insertQuery, photoID, req.Longitude, req.Latitude, distanceKm, time.Now())
	if err != nil {
		// Log but don't fail the request - guessing should still work
		fmt.Printf("Failed to store guess: %v\n", err)
	}

	// Fetch other guesses for this photo (excluding the one just made, limit to recent 50)
	guessQuery := `
		SELECT guess_longitude, guess_latitude
		FROM guesses
		WHERE photo_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`
	rows, _ := h.db.Pool.Query(context.Background(), guessQuery, photoID)
	defer rows.Close()

	var otherGuesses []models.Location
	for rows.Next() {
		var loc models.Location
		if err := rows.Scan(&loc.Longitude, &loc.Latitude); err == nil {
			otherGuesses = append(otherGuesses, loc)
		}
	}

	response := models.GuessResponse{
		DistanceKm:   distanceKm,
		OtherGuesses: otherGuesses,
	}
	response.ActualLocation.Longitude = actualLon
	response.ActualLocation.Latitude = actualLat

	c.JSON(http.StatusOK, response)
}

func (h *PhotoHandler) ListPhotos(c *gin.Context) {
	query := `SELECT id, s3_key, longitude, latitude, created_at FROM photos ORDER BY created_at DESC`

	rows, err := h.db.Pool.Query(context.Background(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch photos"})
		return
	}
	defer rows.Close()

	var photos []models.PhotoListItem
	for rows.Next() {
		var photo models.PhotoListItem
		var s3Key string
		if err := rows.Scan(&photo.ID, &s3Key, &photo.Longitude, &photo.Latitude, &photo.CreatedAt); err != nil {
			continue
		}
		photo.PhotoURL = h.storage.GetURL(s3Key)
		photos = append(photos, photo)
	}

	if photos == nil {
		photos = []models.PhotoListItem{}
	}

	c.JSON(http.StatusOK, photos)
}

func (h *PhotoHandler) GetPhotoGuesses(c *gin.Context) {
	photoID := c.Param("id")

	query := `SELECT id, guess_longitude, guess_latitude, distance_km, created_at FROM guesses WHERE photo_id = $1 ORDER BY created_at DESC`

	rows, err := h.db.Pool.Query(context.Background(), query, photoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch guesses"})
		return
	}
	defer rows.Close()

	type GuessItem struct {
		ID        string    `json:"id"`
		Longitude float64   `json:"longitude"`
		Latitude  float64   `json:"latitude"`
		DistanceKm float64  `json:"distance_km"`
		CreatedAt time.Time `json:"created_at"`
	}

	var guesses []GuessItem
	for rows.Next() {
		var g GuessItem
		if err := rows.Scan(&g.ID, &g.Longitude, &g.Latitude, &g.DistanceKm, &g.CreatedAt); err != nil {
			continue
		}
		guesses = append(guesses, g)
	}

	if guesses == nil {
		guesses = []GuessItem{}
	}

	c.JSON(http.StatusOK, guesses)
}

func (h *PhotoHandler) UpdatePhotoLocation(c *gin.Context) {
	photoID := c.Param("id")

	var req struct {
		Latitude  float64 `json:"latitude" binding:"required"`
		Longitude float64 `json:"longitude" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	query := `UPDATE photos SET latitude = $1, longitude = $2, updated_at = $3 WHERE id = $4`
	result, err := h.db.Pool.Exec(context.Background(), query, req.Latitude, req.Longitude, time.Now(), photoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update photo"})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Photo not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Location updated"})
}

func (h *PhotoHandler) DeletePhoto(c *gin.Context) {
	photoID := c.Param("id")

	query := `SELECT s3_key FROM photos WHERE id = $1`
	var s3Key string
	err := h.db.Pool.QueryRow(context.Background(), query, photoID).Scan(&s3Key)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Photo not found"})
		return
	}

	if err := h.storage.Delete(c.Request.Context(), s3Key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete photo from storage"})
		return
	}

	deleteQuery := `DELETE FROM photos WHERE id = $1`
	_, err = h.db.Pool.Exec(context.Background(), deleteQuery, photoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete photo metadata"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Photo deleted"})
}
