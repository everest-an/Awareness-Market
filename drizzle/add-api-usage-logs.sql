-- API Usage Logs table for tracking API key usage
CREATE TABLE IF NOT EXISTS `api_usage_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `api_key_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `endpoint` VARCHAR(255) NOT NULL,
  `method` VARCHAR(10) NOT NULL,
  `status_code` INT NOT NULL,
  `response_time_ms` INT NOT NULL,
  `request_size_bytes` INT DEFAULT 0,
  `response_size_bytes` INT DEFAULT 0,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `error_message` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `api_key_idx` (`api_key_id`),
  INDEX `user_idx` (`user_id`),
  INDEX `endpoint_idx` (`endpoint`),
  INDEX `created_at_idx` (`created_at`),
  FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate Limit Configuration table
CREATE TABLE IF NOT EXISTS `rate_limit_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `api_key_id` INT NOT NULL UNIQUE,
  `requests_per_hour` INT DEFAULT 1000 NOT NULL,
  `requests_per_day` INT DEFAULT 10000 NOT NULL,
  `requests_per_month` INT DEFAULT 100000 NOT NULL,
  `burst_limit` INT DEFAULT 100 NOT NULL,
  `is_enabled` BOOLEAN DEFAULT TRUE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
