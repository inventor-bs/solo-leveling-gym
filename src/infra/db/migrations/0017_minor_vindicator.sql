CREATE TABLE `weekly_schedule_swap` (
	`week_start` text PRIMARY KEY NOT NULL,
	`weekday_from` integer NOT NULL,
	`weekday_to` integer NOT NULL,
	`swapped_at` integer NOT NULL
);
