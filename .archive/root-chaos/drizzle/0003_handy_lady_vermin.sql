CREATE TABLE `ai_memory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`memory_key` varchar(255) NOT NULL,
	`memory_data` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`expires_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_memory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`key_hash` varchar(255) NOT NULL,
	`key_prefix` varchar(16) NOT NULL,
	`name` varchar(255) NOT NULL,
	`permissions` text,
	`last_used_at` timestamp,
	`expires_at` timestamp,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_key_hash_unique` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE INDEX `user_key_idx` ON `ai_memory` (`user_id`,`memory_key`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `key_hash_idx` ON `api_keys` (`key_hash`);