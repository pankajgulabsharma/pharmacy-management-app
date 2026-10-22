ALTER TABLE `sale_returns` ADD `points_reversed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_returns` ADD `points_restored` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `points_earned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `points_redeemed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `points_balance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `points_paise` integer DEFAULT 0 NOT NULL;