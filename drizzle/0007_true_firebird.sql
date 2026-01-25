CREATE TABLE `vector_invocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`vector_id` int NOT NULL,
	`permission_id` int NOT NULL,
	`input_data` text,
	`output_data` text,
	`tokens_used` int,
	`execution_time` int,
	`status` enum('success','error','timeout') NOT NULL DEFAULT 'success',
	`error_message` text,
	`cost` decimal(10,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vector_invocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_idx` ON `vector_invocations` (`user_id`);--> statement-breakpoint
CREATE INDEX `vector_idx` ON `vector_invocations` (`vector_id`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `vector_invocations` (`createdAt`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `vector_invocations` (`status`);