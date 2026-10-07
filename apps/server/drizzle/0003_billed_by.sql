ALTER TABLE `sale_returns` ADD `billed_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `billed_by` text DEFAULT '' NOT NULL;