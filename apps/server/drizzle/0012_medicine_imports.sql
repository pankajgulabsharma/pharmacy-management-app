CREATE TABLE `medicine_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`rows` integer NOT NULL,
	`created_ids_json` text DEFAULT '[]' NOT NULL,
	`existing_count` integer DEFAULT 0 NOT NULL,
	`batch_lines` integer DEFAULT 0 NOT NULL,
	`undone_at` text DEFAULT '' NOT NULL
);
