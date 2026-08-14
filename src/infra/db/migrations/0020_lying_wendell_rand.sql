ALTER TABLE `hunter` ADD `title_frame` text;--> statement-breakpoint
ALTER TABLE `hunter` ADD `dashboard_order` text;--> statement-breakpoint
ALTER TABLE `hunter` ADD `aura_level` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shadow` ADD `equipped_skin_id` text;