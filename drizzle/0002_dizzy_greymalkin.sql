CREATE TABLE `catch_likes` (
	`catch_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`catch_id`, `user_id`),
	FOREIGN KEY (`catch_id`) REFERENCES `catches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `data_migrations` (
	`name` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `catches` ADD `owner_id` text REFERENCES profiles(user_id);--> statement-breakpoint
CREATE INDEX `idx_catches_owner_date` ON `catches` (`owner_id`,`date`);