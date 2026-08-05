CREATE TABLE `exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`muscle` text NOT NULL,
	`kind` text NOT NULL,
	`is_main_lift` integer DEFAULT false NOT NULL,
	`increment_kg` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `program_day` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`weekday` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `program_day_exercise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_day_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`target_sets` integer NOT NULL,
	`rep_min` integer NOT NULL,
	`rep_max` integer NOT NULL,
	FOREIGN KEY (`program_day_id`) REFERENCES `program_day`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `program_day_exercise_unique_idx` ON `program_day_exercise` (`program_day_id`,`exercise_id`);