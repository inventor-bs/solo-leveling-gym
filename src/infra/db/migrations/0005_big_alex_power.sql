CREATE TABLE `shadow` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`muscle` text,
	`exp` real DEFAULT 0 NOT NULL,
	`extracted_at` integer,
	`last_trained_day` text
);
