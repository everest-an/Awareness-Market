CREATE TABLE `creator_reputations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`reputation_score` decimal(5,2) NOT NULL DEFAULT '100.00',
	`total_vectors` int NOT NULL DEFAULT 0,
	`total_sales` int NOT NULL DEFAULT 0,
	`total_reports` int NOT NULL DEFAULT 0,
	`resolved_reports` int NOT NULL DEFAULT 0,
	`average_rating` decimal(3,2),
	`last_calculated_at` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creator_reputations_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_reputations_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `vector_quality_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vector_id` int NOT NULL,
	`check_type` enum('dimension_validation','format_validation','data_integrity','performance_test','manual_review') NOT NULL,
	`status` enum('passed','failed','warning') NOT NULL,
	`score` decimal(5,2),
	`details` text,
	`checked_by` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vector_quality_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vector_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vector_id` int NOT NULL,
	`reporter_id` int NOT NULL,
	`reason` enum('spam','low_quality','misleading','copyright','inappropriate','other') NOT NULL,
	`description` text,
	`status` enum('pending','reviewing','resolved','dismissed') NOT NULL DEFAULT 'pending',
	`admin_notes` text,
	`resolved_by` int,
	`resolved_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vector_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_idx` ON `creator_reputations` (`user_id`);--> statement-breakpoint
CREATE INDEX `reputation_idx` ON `creator_reputations` (`reputation_score`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `vector_quality_checks` (`vector_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `vector_quality_checks` (`status`);--> statement-breakpoint
CREATE INDEX `check_type_idx` ON `vector_quality_checks` (`check_type`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `vector_quality_checks` (`createdAt`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `vector_reports` (`vector_id`);--> statement-breakpoint
CREATE INDEX `reporter_idx` ON `vector_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `vector_reports` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `vector_reports` (`createdAt`);