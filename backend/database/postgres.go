package database

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresDB struct {
	Pool *pgxpool.Pool
}

func Connect(databaseURL string) (*PostgresDB, error) {
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		return nil, err
	}

	err = pool.Ping(context.Background())
	if err != nil {
		return nil, err
	}

	log.Println("Connected to PostgreSQL")

	db := &PostgresDB{Pool: pool}
	if err := db.createTables(); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *PostgresDB) createTables() error {
	query := `
		CREATE TABLE IF NOT EXISTS photos (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			s3_key VARCHAR(512) NOT NULL,
			s3_bucket VARCHAR(255) NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			latitude DOUBLE PRECISION NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);
	`
	_, err := db.Pool.Exec(context.Background(), query)
	return err
}

func (db *PostgresDB) Close() {
	db.Pool.Close()
}
