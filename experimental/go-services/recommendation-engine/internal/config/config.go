package config

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

type Config struct {
	Port      string
	DB        *sql.DB
	APISecret string
}

func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	dbURL := os.Getenv("DATABASE_URL")
	apiSecret := os.Getenv("API_SECRET")
	if apiSecret == "" {
		apiSecret = "default-secret-key"
	}

	var db *sql.DB
	var err error

	if dbURL != "" {
		db, err = sql.Open("mysql", dbURL)
		if err != nil {
			log.Printf("Warning: Failed to connect to database: %v", err)
			log.Println("Running in mock data mode")
		} else {
			if err = db.Ping(); err != nil {
				log.Printf("Warning: Database ping failed: %v", err)
				log.Println("Running in mock data mode")
				db = nil
			}
		}
	}

	return &Config{
		Port:      port,
		DB:        db,
		APISecret: apiSecret,
	}, nil
}
