ALTER TABLE `subscriptions` MODIFY COLUMN `status` enum('trialing','active','past_due','canceled','expired') NOT NULL DEFAULT 'trialing';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `paymentMethod` varchar(50);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `amount` int;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `currency` varchar(10) DEFAULT 'usd';