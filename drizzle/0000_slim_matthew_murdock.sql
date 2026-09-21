CREATE TABLE `catches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`location` text NOT NULL,
	`species` text NOT NULL,
	`count` integer NOT NULL,
	`length` real,
	`method` text DEFAULT '' NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
