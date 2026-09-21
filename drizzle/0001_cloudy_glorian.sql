CREATE TABLE `catch_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`catch_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`catch_id`) REFERENCES `catches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_catch_photos_catch_id` ON `catch_photos` (`catch_id`);