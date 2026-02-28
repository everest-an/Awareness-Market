-- API Usage Logging Tables
-- Migration for tracking API calls and analytics

-- API Usage Logs - Individual API call records
CREATE TABLE IF NOT EXISTS `api_usage_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `api_key_id` INT,
  `api_key_prefix` VARCHAR(20),
  `endpoint` VARCHAR(255) NOT NULL,
  `method` VARCHAR(10) NOT NULL,
  `path` VARCHAR(500) NOT NULL,
  `query_params` TEXT,
  `status_code` INT NOT NULL,
  `response_time_ms` INT NOT NULL,
  `response_size` INT,
  `error_code` VARCHAR(50),
  `error_message` TEXT,
  `ip_address` VARCHAR(45),
  `user_agent` VARCHAR(500),
  `referer` VARCHAR(500),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `api_usage_user_id_idx` (`user_id`),
  INDEX `api_usage_api_key_id_idx` (`api_key_id`),
  INDEX `api_usage_endpoint_idx` (`endpoint`),
  INDEX `api_usage_created_at_idx` (`created_at`),
  INDEX `api_usage_status_code_idx` (`status_code`)
);

-- API Usage Daily Aggregates - Pre-computed daily stats
CREATE TABLE IF NOT EXISTS `api_usage_daily_stats` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `api_key_id` INT,
  `endpoint` VARCHAR(255) NOT NULL,
  `date` TIMESTAMP NOT NULL,
  `total_requests` INT DEFAULT 0 NOT NULL,
  `successful_requests` INT DEFAULT 0 NOT NULL,
  `failed_requests` INT DEFAULT 0 NOT NULL,
  `avg_response_time` INT DEFAULT 0,
  `min_response_time` INT,
  `max_response_time` INT,
  `p95_response_time` INT,
  `total_response_size` INT DEFAULT 0,
  `error_4xx_count` INT DEFAULT 0,
  `error_5xx_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX `api_daily_user_date_idx` (`user_id`, `date`),
  INDEX `api_daily_apikey_date_idx` (`api_key_id`, `date`),
  INDEX `api_daily_endpoint_date_idx` (`endpoint`, `date`)
);

-- API Endpoints Registry - Track all available endpoints
CREATE TABLE IF NOT EXISTS `api_endpoints` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `path` VARCHAR(255) NOT NULL UNIQUE,
  `method` VARCHAR(10) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(50),
  `rate_limit` INT DEFAULT 100,
  `rate_limit_window` INT DEFAULT 60,
  `is_public` BOOLEAN DEFAULT FALSE,
  `requires_auth` BOOLEAN DEFAULT TRUE,
  `is_deprecated` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
);
