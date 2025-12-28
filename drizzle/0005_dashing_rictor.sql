CREATE TABLE `ab_test_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`experiment_id` int NOT NULL,
	`user_id` int NOT NULL,
	`assigned_algorithm` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ab_test_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ab_test_experiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`algorithm_a` varchar(100) NOT NULL,
	`algorithm_b` varchar(100) NOT NULL,
	`traffic_split` decimal(3,2) NOT NULL DEFAULT '0.50',
	`status` enum('draft','running','paused','completed') NOT NULL DEFAULT 'draft',
	`start_date` timestamp,
	`end_date` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ab_test_experiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_behavior` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`vector_id` int NOT NULL,
	`action_type` enum('view','click','trial','purchase','review') NOT NULL,
	`duration` int,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_behavior_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `experiment_user_idx` ON `ab_test_assignments` (`experiment_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `user_behavior` (`user_id`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `user_behavior` (`vector_id`);--> statement-breakpoint
CREATE INDEX `action_idx` ON `user_behavior` (`action_type`);