package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"rpi_guessr/backend/database"
	"rpi_guessr/backend/models"
	"rpi_guessr/backend/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rwcarlsen/goexif/exif"
)

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
