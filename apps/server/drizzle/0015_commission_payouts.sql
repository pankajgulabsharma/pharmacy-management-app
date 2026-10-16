CREATE TABLE `commission_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	`paid_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`paid_by` text DEFAULT '' NOT NULL,
	CONSTRAINT "commission_payouts_amount_ok" CHECK("commission_payouts"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE INDEX `commission_payouts_period_idx` ON `commission_payouts` (`from_date`);