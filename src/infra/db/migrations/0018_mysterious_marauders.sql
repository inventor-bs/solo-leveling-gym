CREATE TABLE `session_bank` (
	`id` text PRIMARY KEY NOT NULL,
	`banked_sessions` integer DEFAULT 0 NOT NULL,
	`pending_credits` integer DEFAULT 0 NOT NULL,
	`last_deposited_session_id` text
);
