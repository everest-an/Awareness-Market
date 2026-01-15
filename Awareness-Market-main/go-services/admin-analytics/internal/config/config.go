package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

type Config struct {
	Port      string
	DBConnStr string
	DB        *sql.DB
}

func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "root"
	}

	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "latentmind_marketplace"
	}

	connStr := fmt.Sprintf("%s:%s@tcp(%s:3306)/%s?parseTime=true",
		dbUser, dbPassword, dbHost, dbName)

	db, err := sql.Open("mysql", connStr)
	if err != nil {
		log.Printf("⚠️  Failed to open database: %v (using mock data)", err)
		db = nil
	} else if err := db.Ping(); err != nil {
		log.Printf("⚠️  Database connection failed: %v (using mock data)", err)
		db.Close()
		db = nil
	} else {
		log.Println("✅ Connected to MySQL database")
	}

	return &Config{
		Port:      port,
		DBConnStr: connStr,
		DB:        db,
	}, nil
}
