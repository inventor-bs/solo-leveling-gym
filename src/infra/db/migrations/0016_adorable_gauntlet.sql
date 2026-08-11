CREATE TABLE `quest_override` (
	`day` text PRIMARY KEY NOT NULL,
	`field` text NOT NULL,
	`previous_value` real NOT NULL,
	`new_value` real NOT NULL,
	`applied_at` integer NOT NULL
);
