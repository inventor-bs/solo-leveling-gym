CREATE TABLE `wager` (
	`week_start` text PRIMARY KEY NOT NULL,
	`stake_gold` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`placed_at` integer NOT NULL,
	`resolved_at` integer
);
