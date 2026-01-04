package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// InitDB initializes the database connection
func InitDB() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	// Convert mysql:// URL to DSN format
	dsn := convertMySQLURL(databaseURL)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool settings
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// Test the connection
	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("✅ Database connected successfully")
	return nil
}

// convertMySQLURL converts mysql:// URL to DSN format with SSL support
func convertMySQLURL(urlStr string) string {
	if len(urlStr) > 8 && urlStr[:8] == "mysql://" {
		urlStr = urlStr[8:]
	}
	
	atIndex := -1
	for i, c := range urlStr {
		if c == '@' {
			atIndex = i
			break
		}
	}
	
	if atIndex == -1 {
		return urlStr
	}
	
	credentials := urlStr[:atIndex]
	hostAndPath := urlStr[atIndex+1:]
	
	slashIndex := -1
	for i, c := range hostAndPath {
		if c == '/' {
			slashIndex = i
			break
		}
	}
	
	if slashIndex == -1 {
		return credentials + "@tcp(" + hostAndPath + ")/"
	}
	
	host := hostAndPath[:slashIndex]
	pathAndParams := hostAndPath[slashIndex:]
	
	questionIndex := -1
	for i, c := range pathAndParams {
		if c == '?' {
			questionIndex = i
			break
		}
	}
	
	if questionIndex != -1 {
		path := pathAndParams[:questionIndex]
		params := pathAndParams[questionIndex+1:]
		
		if len(params) >= 4 && params[:4] == "ssl=" {
			pathAndParams = path + "?tls=true"
		}
	}
	
	return credentials + "@tcp(" + host + ")" + pathAndParams
}

// CloseDB closes the database connection
func CloseDB() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
