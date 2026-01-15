CREATE TABLE `memory_exchanges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`buyer_id` int NOT NULL,
	`memory_type` enum('kv_cache','reasoning_chain','long_term_memory') NOT NULL,
	`kv_cache_data` text,
	`w_matrix_version` varchar(20),
	`source_model` varchar(50),
	`target_model` varchar(50),
	`context_length` int,
	`token_count` int,
	`price` decimal(10,2) NOT NULL,
	`quality_score` decimal(3,2),
	`alignment_quality` text,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_exchanges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reasoning_chains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_id` int NOT NULL,
	`chain_name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(100) NOT NULL,
	`input_example` text,
	`output_example` text,
	`kv_cache_snapshot` text,
	`source_model` varchar(50) NOT NULL,
	`w_matrix_version` varchar(20),
	`step_count` int,
	`avg_quality` decimal(3,2) DEFAULT '0.00',
	`review_count` int NOT NULL DEFAULT 0,
	`price_per_use` decimal(10,2) NOT NULL,
	`usage_count` int NOT NULL DEFAULT 0,
	`total_revenue` decimal(12,2) NOT NULL DEFAULT '0.00',
	`status` enum('draft','active','inactive') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reasoning_chains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `w_matrix_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(20) NOT NULL,
	`source_model` varchar(50) NOT NULL,
	`target_model` varchar(50) NOT NULL,
	`method` enum('orthogonal','learned','hybrid') NOT NULL,
	`unified_dimension` int NOT NULL,
	`quality_metrics` text,
	`transformation_rules` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `w_matrix_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `w_matrix_versions_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
ALTER TABLE `latent_vectors` ADD `vector_type` enum('embedding','kv_cache','reasoning_chain') DEFAULT 'embedding' NOT NULL;--> statement-breakpoint
ALTER TABLE `latent_vectors` ADD `kv_cache_metadata` text;--> statement-breakpoint
ALTER TABLE `latent_vectors` ADD `w_matrix_version` varchar(20);--> statement-breakpoint
CREATE INDEX `seller_idx` ON `memory_exchanges` (`seller_id`);--> statement-breakpoint
CREATE INDEX `buyer_idx` ON `memory_exchanges` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `memory_type_idx` ON `memory_exchanges` (`memory_type`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `memory_exchanges` (`status`);--> statement-breakpoint
CREATE INDEX `creator_idx` ON `reasoning_chains` (`creator_id`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `reasoning_chains` (`category`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `reasoning_chains` (`status`);--> statement-breakpoint
CREATE INDEX `version_idx` ON `w_matrix_versions` (`version`);--> statement-breakpoint
CREATE INDEX `model_pair_idx` ON `w_matrix_versions` (`source_model`,`target_model`);--> statement-breakpoint
CREATE INDEX `is_active_idx` ON `w_matrix_versions` (`is_active`);