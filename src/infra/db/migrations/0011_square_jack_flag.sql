CREATE TABLE `demon_castle_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`highest_floor_cleared` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_challenge` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`purchased_at` integer NOT NULL,
	`floor` integer
);
--> statement-breakpoint
CREATE TABLE `store_unlock` (
	`key` text PRIMARY KEY NOT NULL,
	`unlocked_at` integer NOT NULL
);
