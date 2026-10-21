CREATE TABLE `cash_days` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`counter` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`opening_paise` integer DEFAULT 0 NOT NULL,
	`opened_at` text NOT NULL,
	`opened_by` text DEFAULT '' NOT NULL,
	`counted_paise` integer,
	`expected_paise` integer,
	`kept_paise` integer,
	`denominations_json` text DEFAULT '{}' NOT NULL,
	`closed_at` text,
	`closed_by` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	CONSTRAINT "cash_days_opening_ok" CHECK("cash_days"."opening_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_days_date_counter_idx` ON `cash_days` (`date`,`counter`);--> statement-breakpoint
CREATE TABLE `cash_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`counter` text DEFAULT '' NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`by` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`ref` text DEFAULT '' NOT NULL,
	CONSTRAINT "cash_entries_amount_ok" CHECK("cash_entries"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE INDEX `cash_entries_day_idx` ON `cash_entries` (`date`,`counter`);--> statement-breakpoint
CREATE TABLE `sign_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`session_hash` text DEFAULT '' NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`role` text NOT NULL,
	`counter` text DEFAULT '' NOT NULL,
	`computer` text DEFAULT '' NOT NULL,
	`method` text NOT NULL,
	`signed_in_at` text NOT NULL,
	`signed_out_at` text,
	`reason` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sign_ins_at_idx` ON `sign_ins` (`signed_in_at`);--> statement-breakpoint
CREATE INDEX `sign_ins_session_idx` ON `sign_ins` (`session_hash`);