-- Agent Collaboration Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id VARCHAR(64) PRIMARY KEY,
  task VARCHAR(500) NOT NULL,
  description TEXT,
  status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  orchestration ENUM('sequential', 'parallel') NOT NULL,
  memory_sharing ENUM('enabled', 'disabled') NOT NULL DEFAULT 'enabled',
  memory_ttl INT NOT NULL DEFAULT 86400,
  max_execution_time INT NOT NULL DEFAULT 600,
  record_on_chain ENUM('yes', 'no') NOT NULL DEFAULT 'yes',
  created_by INT NOT NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  total_execution_time INT NULL COMMENT 'milliseconds',
  shared_memory JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX created_by_idx (created_by),
  INDEX status_idx (status),
  INDEX created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workflow Steps
CREATE TABLE IF NOT EXISTS workflow_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id VARCHAR(64) NOT NULL,
  step_index INT NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  status ENUM('pending', 'running', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  input JSON NULL,
  output JSON NULL,
  error TEXT NULL,
  memory_keys JSON NULL COMMENT 'Array of shared memory keys',
  execution_time INT NULL COMMENT 'milliseconds',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX workflow_id_idx (workflow_id),
  INDEX status_idx (status),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- On-Chain Interaction Records
CREATE TABLE IF NOT EXISTS on_chain_interactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id VARCHAR(64),
  from_agent_id VARCHAR(255) NOT NULL,
  to_agent_id VARCHAR(255) NOT NULL,
  success ENUM('yes', 'no') NOT NULL,
  weight INT NOT NULL,
  interaction_type VARCHAR(50) NOT NULL DEFAULT 'collaboration',
  tx_hash VARCHAR(66),
  block_number INT,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX workflow_id_idx (workflow_id),
  INDEX from_agent_idx (from_agent_id),
  INDEX to_agent_idx (to_agent_id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
