CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` text NOT NULL,
	`supplier_id` text NOT NULL,
	`supplier_name` text NOT NULL,
	`status` text NOT NULL,
	`date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`lines_json` text DEFAULT '[]' NOT NULL,
	`receipts_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`sent_at` text,
	`closed_at` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_order_no_unique` ON `purchase_orders` (`order_no`);--> statement-breakpoint
CREATE INDEX `purchase_orders_status_idx` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_idx` ON `purchase_orders` (`supplier_id`);