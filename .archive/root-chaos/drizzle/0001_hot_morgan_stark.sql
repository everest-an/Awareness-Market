CREATE TABLE `access_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`vector_id` int NOT NULL,
	`transaction_id` int NOT NULL,
	`access_token` varchar(255) NOT NULL,
	`expires_at` timestamp,
	`calls_remaining` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `access_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `access_permissions_access_token_unique` UNIQUE(`access_token`)
);
--> statement-breakpoint
CREATE TABLE `api_call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`vector_id` int NOT NULL,
	`permission_id` int NOT NULL,
	`response_time` int,
	`success` boolean NOT NULL DEFAULT true,
	`error_message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `latent_vectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(100) NOT NULL,
	`vector_file_key` text NOT NULL,
	`vector_file_url` text NOT NULL,
	`model_architecture` varchar(100),
	`vector_dimension` int,
	`performance_metrics` text,
	`base_price` decimal(10,2) NOT NULL,
	`pricing_model` enum('per-call','subscription','usage-based') NOT NULL DEFAULT 'per-call',
	`status` enum('draft','active','inactive','suspended') NOT NULL DEFAULT 'draft',
	`total_calls` int NOT NULL DEFAULT 0,
	`total_revenue` decimal(12,2) NOT NULL DEFAULT '0.00',
	`average_rating` decimal(3,2) DEFAULT '0.00',
	`review_count` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `latent_vectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`type` enum('transaction','review','system','subscription') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`related_entity_id` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vector_id` int NOT NULL,
	`user_id` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`is_verified_purchase` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`billing_cycle` enum('monthly','yearly') NOT NULL,
	`features` text,
	`call_limit` int,
	`stripe_price_id` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyer_id` int NOT NULL,
	`vector_id` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`platform_fee` decimal(10,2) NOT NULL,
	`creator_earnings` decimal(10,2) NOT NULL,
	`stripe_payment_intent_id` varchar(255),
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`transaction_type` enum('one-time','subscription') NOT NULL DEFAULT 'one-time',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`preferred_categories` text,
	`price_range` text,
	`last_recommendation_update` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`stripe_subscription_id` varchar(255),
	`status` enum('active','cancelled','expired','past_due') NOT NULL DEFAULT 'active',
	`current_period_start` timestamp NOT NULL,
	`current_period_end` timestamp NOT NULL,
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','creator','consumer') NOT NULL DEFAULT 'consumer';--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` text;--> statement-breakpoint
CREATE INDEX `user_vector_idx` ON `access_permissions` (`user_id`,`vector_id`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `access_permissions` (`access_token`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `api_call_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `api_call_logs` (`vector_id`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `api_call_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `creator_idx` ON `latent_vectors` (`creator_id`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `latent_vectors` (`category`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `latent_vectors` (`status`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `is_read_idx` ON `notifications` (`is_read`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `reviews` (`vector_id`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `reviews` (`user_id`);--> statement-breakpoint
CREATE INDEX `buyer_idx` ON `transactions` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `transactions` (`vector_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `user_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `user_subscriptions` (`status`);