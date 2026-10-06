CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`batch_no` text NOT NULL,
	`expiry` text NOT NULL,
	`qty_strip` integer DEFAULT 0 NOT NULL,
	`qty_loose` integer DEFAULT 0 NOT NULL,
	`mrp_paise` integer DEFAULT 0 NOT NULL,
	`purchase_price_paise` integer DEFAULT 0 NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "batches_stock_not_negative" CHECK("batches"."qty_strip" >= 0 AND "batches"."qty_loose" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `batches_medicine_batch_uq` ON `batches` (`medicine_id`,`batch_no`);--> statement-breakpoint
CREATE TABLE `customer_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_no` text NOT NULL,
	`customer_id` text NOT NULL,
	`at` text NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	`method` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customer_payments_positive" CHECK("customer_payments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_payments_receipt_no_unique` ON `customer_payments` (`receipt_no`);--> statement-breakpoint
CREATE INDEX `customer_payments_customer_idx` ON `customer_payments` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`credit_limit_paise` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_uq` ON `customers` (`phone`) WHERE "customers"."phone" <> '';--> statement-breakpoint
CREATE TABLE `held_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`held_at` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`doctor` text DEFAULT '' NOT NULL,
	`counter` text DEFAULT '' NOT NULL,
	`lines_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`salt` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`hsn` text DEFAULT '' NOT NULL,
	`barcode` text DEFAULT '' NOT NULL,
	`rack` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`units_per_strip` integer DEFAULT 1 NOT NULL,
	`allow_loose` integer DEFAULT false NOT NULL,
	`mrp_paise` integer DEFAULT 0 NOT NULL,
	`sale_price_paise` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`gst_percent` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	CONSTRAINT "medicines_price_ok" CHECK("medicines"."mrp_paise" >= 0 AND "medicines"."sale_price_paise" >= 0 AND "medicines"."sale_price_paise" <= "medicines"."mrp_paise"),
	CONSTRAINT "medicines_gst_ok" CHECK("medicines"."gst_percent" IN (0, 5, 12, 18))
);
--> statement-breakpoint
CREATE INDEX `medicines_name_idx` ON `medicines` (`name`);--> statement-breakpoint
CREATE TABLE `purchase_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`position` integer NOT NULL,
	`medicine_id` text NOT NULL,
	`medicine_name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`hsn` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`units_per_strip` integer DEFAULT 1 NOT NULL,
	`batch_no` text NOT NULL,
	`expiry` text NOT NULL,
	`qty` integer NOT NULL,
	`free_qty` integer DEFAULT 0 NOT NULL,
	`rate_paise` integer DEFAULT 0 NOT NULL,
	`mrp_paise` integer DEFAULT 0 NOT NULL,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`gst_percent` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_lines_qty_ok" CHECK("purchase_lines"."qty" > 0 AND "purchase_lines"."free_qty" >= 0)
);
--> statement-breakpoint
CREATE INDEX `purchase_lines_purchase_idx` ON `purchase_lines` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `purchase_return_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`return_id` text NOT NULL,
	`purchase_line_id` text NOT NULL,
	`medicine_id` text NOT NULL,
	`medicine_name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`units_per_strip` integer DEFAULT 1 NOT NULL,
	`batch_no` text NOT NULL,
	`expiry` text NOT NULL,
	`qty` integer NOT NULL,
	`rate_paise` integer DEFAULT 0 NOT NULL,
	`gst_percent` integer NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	`gst_paise` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `purchase_returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`purchase_line_id`) REFERENCES `purchase_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`return_no` text NOT NULL,
	`purchase_id` text NOT NULL,
	`invoice_no` text NOT NULL,
	`supplier_id` text NOT NULL,
	`supplier_name` text NOT NULL,
	`supplier_gstin` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`reason` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`total_qty` integer NOT NULL,
	`total_paise` integer DEFAULT 0 NOT NULL,
	`gst_paise` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_returns_return_no_unique` ON `purchase_returns` (`return_no`);--> statement-breakpoint
CREATE INDEX `purchase_returns_purchase_idx` ON `purchase_returns` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`stock_posted` integer DEFAULT false NOT NULL,
	`supplier_id` text NOT NULL,
	`supplier_name` text NOT NULL,
	`supplier_gstin` text DEFAULT '' NOT NULL,
	`invoice_no` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`line_count` integer NOT NULL,
	`total_qty` integer NOT NULL,
	`total_free_qty` integer NOT NULL,
	`gross_paise` integer DEFAULT 0 NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`taxable_paise` integer DEFAULT 0 NOT NULL,
	`cgst_paise` integer DEFAULT 0 NOT NULL,
	`sgst_paise` integer DEFAULT 0 NOT NULL,
	`gst_paise` integer DEFAULT 0 NOT NULL,
	`round_off_paise` integer DEFAULT 0 NOT NULL,
	`net_paise` integer DEFAULT 0 NOT NULL,
	`paid_paise` integer DEFAULT 0 NOT NULL,
	`returned_paise` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL,
	`cancelled_at` text DEFAULT '' NOT NULL,
	`cancel_reason` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchases_money_ok" CHECK("purchases"."paid_paise" >= 0 AND "purchases"."returned_paise" >= 0 AND "purchases"."net_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_supplier_invoice_uq` ON `purchases` (`supplier_id`,`invoice_no`);--> statement-breakpoint
CREATE INDEX `purchases_date_idx` ON `purchases` (`invoice_date`);--> statement-breakpoint
CREATE TABLE `sale_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_line_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`batch_no` text NOT NULL,
	`expiry` text NOT NULL,
	`qty_strip` integer DEFAULT 0 NOT NULL,
	`qty_loose` integer DEFAULT 0 NOT NULL,
	`break_strips` integer DEFAULT 0 NOT NULL,
	`rate_paise` integer DEFAULT 0 NOT NULL,
	`mrp_paise` integer DEFAULT 0 NOT NULL,
	`cost_paise` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sale_line_id`) REFERENCES `sale_lines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sale_allocations_line_idx` ON `sale_allocations` (`sale_line_id`);--> statement-breakpoint
CREATE TABLE `sale_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`position` integer NOT NULL,
	`medicine_id` text NOT NULL,
	`medicine_name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`hsn` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`units_per_strip` integer DEFAULT 1 NOT NULL,
	`gst_percent` integer NOT NULL,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`qty_strip` integer DEFAULT 0 NOT NULL,
	`qty_loose` integer DEFAULT 0 NOT NULL,
	`gross_paise` integer DEFAULT 0 NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	`taxable_paise` integer DEFAULT 0 NOT NULL,
	`gst_paise` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sale_lines_sale_idx` ON `sale_lines` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sale_return_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_line_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`qty_strip` integer DEFAULT 0 NOT NULL,
	`qty_loose` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`return_line_id`) REFERENCES `sale_return_lines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sale_return_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`return_id` text NOT NULL,
	`sale_line_id` text NOT NULL,
	`medicine_id` text NOT NULL,
	`medicine_name` text NOT NULL,
	`unit` text NOT NULL,
	`units_per_strip` integer DEFAULT 1 NOT NULL,
	`qty_strip` integer DEFAULT 0 NOT NULL,
	`qty_loose` integer DEFAULT 0 NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `sale_returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sale_line_id`) REFERENCES `sale_lines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sale_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`return_no` text NOT NULL,
	`sale_id` text NOT NULL,
	`bill_no` text NOT NULL,
	`customer_name` text NOT NULL,
	`created_at` text NOT NULL,
	`reason` text NOT NULL,
	`refund_mode` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`round_off_paise` integer DEFAULT 0 NOT NULL,
	`refund_paise` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sale_returns_return_no_unique` ON `sale_returns` (`return_no`);--> statement-breakpoint
CREATE INDEX `sale_returns_sale_idx` ON `sale_returns` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_no` text NOT NULL,
	`created_at` text NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`doctor` text DEFAULT '' NOT NULL,
	`counter` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`imported` integer DEFAULT false NOT NULL,
	`item_count` integer NOT NULL,
	`gross_paise` integer DEFAULT 0 NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`taxable_paise` integer DEFAULT 0 NOT NULL,
	`cgst_paise` integer DEFAULT 0 NOT NULL,
	`sgst_paise` integer DEFAULT 0 NOT NULL,
	`gst_paise` integer DEFAULT 0 NOT NULL,
	`round_off_paise` integer DEFAULT 0 NOT NULL,
	`net_paise` integer DEFAULT 0 NOT NULL,
	`returned_paise` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`received_paise` integer DEFAULT 0 NOT NULL,
	`change_paise` integer DEFAULT 0 NOT NULL,
	`split_cash_paise` integer DEFAULT 0 NOT NULL,
	`split_upi_paise` integer DEFAULT 0 NOT NULL,
	`split_card_paise` integer DEFAULT 0 NOT NULL,
	`payment_reference` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sales_udhaar_has_customer" CHECK("sales"."status" <> 'udhaar' OR "sales"."customer_id" IS NOT NULL),
	CONSTRAINT "sales_money_ok" CHECK("sales"."net_paise" >= 0 AND "sales"."returned_paise" >= 0 AND "sales"."returned_paise" <= "sales"."net_paise")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_bill_no_unique` ON `sales` (`bill_no`);--> statement-breakpoint
CREATE INDEX `sales_created_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`batch_id` text NOT NULL,
	`medicine_id` text NOT NULL,
	`qty_strip_delta` integer NOT NULL,
	`qty_loose_delta` integer NOT NULL,
	`at` text NOT NULL,
	`ref_id` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `movements_batch_idx` ON `stock_movements` (`batch_id`,`at`);--> statement-breakpoint
CREATE INDEX `movements_ref_idx` ON `stock_movements` (`ref_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`gstin` text DEFAULT '' NOT NULL,
	`drug_license_no` text DEFAULT '' NOT NULL,
	`contact_person` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`credit_days` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);