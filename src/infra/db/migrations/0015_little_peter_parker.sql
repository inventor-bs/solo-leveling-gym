CREATE TABLE `hunter_skill` (
	`skill_id` text PRIMARY KEY NOT NULL,
	`learned_at` integer,
	`equipped_at` integer
);
--> statement-breakpoint
CREATE TABLE `skill_slot_unlock` (
	`id` text PRIMARY KEY NOT NULL,
	`slots_purchased` integer DEFAULT 0 NOT NULL
);
