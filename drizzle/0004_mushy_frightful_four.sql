CREATE TABLE `catch_fish` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`catch_id` integer NOT NULL,
	`species` text NOT NULL,
	`count` integer NOT NULL,
	`length` real,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`catch_id`) REFERENCES `catches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_catch_fish_catch_id` ON `catch_fish` (`catch_id`);--> statement-breakpoint
CREATE INDEX `idx_catch_fish_species` ON `catch_fish` (`species`);--> statement-breakpoint
INSERT INTO `catch_fish` (`catch_id`,`species`,`count`,`length`,`sort_order`)
SELECT `id`,`species`,`count`,`length`,0 FROM `catches`;--> statement-breakpoint
ALTER TABLE `catch_photos` ADD `species` text;--> statement-breakpoint
UPDATE `catch_photos` SET `species`=(SELECT `species` FROM `catches` WHERE `catches`.`id`=`catch_photos`.`catch_id`);--> statement-breakpoint
ALTER TABLE `catches` ADD `featured_photo_id` integer;--> statement-breakpoint
UPDATE `catches` SET `featured_photo_id`=(SELECT MIN(`id`) FROM `catch_photos` WHERE `catch_photos`.`catch_id`=`catches`.`id`);
