CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`author_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`excerpt` text,
	`content` text NOT NULL,
	`cover_image` text,
	`tags` text,
	`category` varchar(100),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`view_count` int NOT NULL DEFAULT 0,
	`published_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `slug_idx` ON `blog_posts` (`slug`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `blog_posts` (`status`);--> statement-breakpoint
CREATE INDEX `published_at_idx` ON `blog_posts` (`published_at`);