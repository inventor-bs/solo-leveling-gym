CREATE TABLE `hidden_quest` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`revealed_day` text NOT NULL,
	`revealed_at` integer NOT NULL,
	`gold_awarded` integer NOT NULL
);
