package models

import (
	"time"
)

type Photo struct {
	ID        string    `json:"id"`
	S3Key     string    `json:"s3_key"`
	S3Bucket  string    `json:"s3_bucket"`
	Longitude float64   `json:"longitude"`
	Latitude  float64   `json:"latitude"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type RandomPhotoResponse struct {
	ID       string `json:"id"`
	PhotoURL string `json:"photo_url"`
}

type PhotoInfoResponse struct {
	ID        string    `json:"id"`
	Longitude float64   `json:"longitude"`
	Latitude  float64   `json:"latitude"`
	CreatedAt time.Time `json:"created_at"`
}

type GuessRequest struct {
	Longitude float64 `json:"longitude" binding:"required"`
	Latitude  float64 `json:"latitude" binding:"required"`
}

type Location struct {
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
}

type GuessResponse struct {
	DistanceKm     float64 `json:"distance_km"`
	ActualLocation struct {
		Longitude float64 `json:"longitude"`
		Latitude  float64 `json:"latitude"`
	} `json:"actual_location"`
	OtherGuesses []Location `json:"other_guesses,omitempty"`
}

type PhotoListItem struct {
	ID        string    `json:"id"`
	PhotoURL  string    `json:"photo_url"`
	Longitude float64   `json:"longitude"`
	Latitude  float64   `json:"latitude"`
	CreatedAt time.Time `json:"created_at"`
}
