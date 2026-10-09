ALTER TABLE `sales` ADD `customer_gstin` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `interstate` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `sale_returns_created_idx` ON `sale_returns` (`created_at`);