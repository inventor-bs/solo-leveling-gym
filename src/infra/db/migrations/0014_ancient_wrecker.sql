CREATE TABLE `hourglass_grace` (
	`day` text PRIMARY KEY NOT NULL,
	`used_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shadow_feed` (
	`shadow_id` text PRIMARY KEY NOT NULL,
	`extended_until_day` text NOT NULL
);
