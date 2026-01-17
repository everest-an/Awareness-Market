CREATE TABLE `browsing_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`vector_id` int NOT NULL,
	`action` enum('view','click','search') NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `browsing_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_idx` ON `browsing_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `browsing_history` (`vector_id`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `browsing_history` (`createdAt`);