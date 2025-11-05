ALTER TABLE `files` ADD `ipfsUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `files` ADD `storageType` enum('r2','ipfs','arweave','multi') DEFAULT 'r2' NOT NULL;