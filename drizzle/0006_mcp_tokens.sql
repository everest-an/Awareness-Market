CREATE TABLE `mcp_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`token_prefix` varchar(16) NOT NULL,
	`name` varchar(255) NOT NULL,
	`permissions` text,
	`last_used_at` timestamp,
	`expires_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mcp_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE INDEX `mcp_token_user_idx` ON `mcp_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX `mcp_token_hash_idx` ON `mcp_tokens` (`token_hash`);
