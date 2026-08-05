CREATE TABLE `run_log` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`distance_km` real NOT NULL,
	`duration_sec` integer NOT NULL,
	`logged_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`program_day_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`rank` text,
	FOREIGN KEY (`program_day_id`) REFERENCES `program_day`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `set_log` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`reps` integer NOT NULL,
	`weight` real NOT NULL,
	`completed` integer NOT NULL,
	`is_pr` integer DEFAULT false NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `set_log_natural_key_idx` ON `set_log` (`session_id`,`exercise_id`,`set_index`);