CREATE TABLE `party_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`at` text NOT NULL,
	`rows` integer NOT NULL,
	`created_ids_json` text DEFAULT '[]' NOT NULL,
	`opening_ids_json` text DEFAULT '[]' NOT NULL,
	`opening_paise` integer DEFAULT 0 NOT NULL,
	`existing_count` integer DEFAULT 0 NOT NULL,
	`undone_at` text DEFAULT '' NOT NULL
);
