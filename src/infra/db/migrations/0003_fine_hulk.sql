CREATE TABLE `daily_quest` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`rank` text NOT NULL,
	`target_pushups` integer NOT NULL,
	`target_situps` integer NOT NULL,
	`target_squats` integer NOT NULL,
	`target_run_km` real NOT NULL,
	`progress_pushups` integer DEFAULT 0 NOT NULL,
	`progress_situps` integer DEFAULT 0 NOT NULL,
	`progress_squats` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_quest_day_unique` ON `daily_quest` (`day`);