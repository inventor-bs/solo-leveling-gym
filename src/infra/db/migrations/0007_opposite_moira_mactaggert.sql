CREATE TABLE `event_log` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`occurred_at` integer NOT NULL
);
