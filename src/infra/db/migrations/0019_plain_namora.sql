CREATE TABLE `job_change_quest` (
	`id` text PRIMARY KEY NOT NULL,
	`started_day` text NOT NULL,
	`consecutive_cleared` integer DEFAULT 0 NOT NULL,
	`failed_at` integer,
	`completed_at` integer
);
