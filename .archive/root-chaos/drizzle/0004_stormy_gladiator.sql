CREATE TABLE `trial_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`vector_id` int NOT NULL,
	`used_calls` int NOT NULL DEFAULT 0,
	`input_data` text,
	`output_data` text,
	`success` boolean NOT NULL DEFAULT true,
	`error_message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trial_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `latent_vectors` ADD `free_trial_calls` int DEFAULT 3 NOT NULL;