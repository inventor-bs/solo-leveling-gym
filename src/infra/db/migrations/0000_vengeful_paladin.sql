CREATE TABLE `hunter` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`exp` integer DEFAULT 0 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`rank` text DEFAULT 'E' NOT NULL,
	`title` text,
	`class_name` text,
	`strength` real DEFAULT 0 NOT NULL,
	`agility` real DEFAULT 0 NOT NULL,
	`vitality` real DEFAULT 0 NOT NULL,
	`intelligence` real DEFAULT 0 NOT NULL,
	`perception` real DEFAULT 0 NOT NULL,
	`luck` real DEFAULT 0 NOT NULL,
	`fatigue` real DEFAULT 0 NOT NULL,
	`reason_for_hunting` text,
	`tz_offset_minutes` integer DEFAULT 420 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `processed_action` (
	`id` text PRIMARY KEY NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer NOT NULL
);
