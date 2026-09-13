ALTER TABLE `players` ADD `life_status` text DEFAULT 'alive' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `death_day` integer;--> statement-breakpoint
ALTER TABLE `players` ADD `revive_deadline_day` integer;--> statement-breakpoint
ALTER TABLE `players` ADD `soul_power` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `last_soul_action_day` integer;--> statement-breakpoint
ALTER TABLE `players` ADD `pending_spirit_loss` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `realm` text;--> statement-breakpoint
ALTER TABLE `players` ADD `level` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `current_spirit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `max_spirit` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `world_started_at` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `cycle` integer DEFAULT 1 NOT NULL;