CREATE TABLE `stock_count_lines` (
	`count_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`medicine_id` text NOT NULL,
	`system_strip` integer DEFAULT 0 NOT NULL,
	`system_loose` integer DEFAULT 0 NOT NULL,
	`counted_strip` integer,
	`counted_loose` integer,
	`counted_by` text DEFAULT '' NOT NULL,
	`counted_at` text,
	FOREIGN KEY (`count_id`) REFERENCES `stock_counts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_count_lines_pk` ON `stock_count_lines` (`count_id`,`batch_id`);--> statement-breakpoint
CREATE TABLE `stock_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`count_no` text NOT NULL,
	`racks_json` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`posted_at` text,
	`posted_by` text DEFAULT '' NOT NULL,
	`summary_json` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_counts_count_no_unique` ON `stock_counts` (`count_no`);--> statement-breakpoint
CREATE INDEX `stock_counts_status_idx` ON `stock_counts` (`status`);