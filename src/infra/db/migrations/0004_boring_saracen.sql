CREATE TABLE `penalty` (
	`id` text PRIMARY KEY NOT NULL,
	`started_day` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`reason` text NOT NULL,
	`variant_id` integer NOT NULL,
	`exp_lost` integer NOT NULL
);
