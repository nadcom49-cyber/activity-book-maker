CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`series_id` text,
	`title` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_text` text NOT NULL,
	`grade` text NOT NULL,
	`subject` text NOT NULL,
	`language` text NOT NULL,
	`page_size` text NOT NULL,
	`page_count` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `books_owner` ON `books` (`owner_id`);--> statement-breakpoint
CREATE INDEX `books_series` ON `books` (`series_id`);--> statement-breakpoint
CREATE TABLE `bundles` (
	`series_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`tags` text NOT NULL,
	`image_keys` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bundles_series` ON `bundles` (`series_id`);--> statement-breakpoint
CREATE TABLE `listings` (
	`book_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`grades` text NOT NULL,
	`subjects` text NOT NULL,
	`tags` text NOT NULL,
	`price_cents` integer
);
--> statement-breakpoint
CREATE TABLE `niche_ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`keyword` text NOT NULL,
	`rank` integer NOT NULL,
	`title` text NOT NULL,
	`angle` text NOT NULL,
	`suggested_pages` integer NOT NULL,
	`demand_note` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `niche_ideas_owner` ON `niche_ideas` (`owner_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`prompt` text NOT NULL,
	`image_key` text
);
--> statement-breakpoint
CREATE INDEX `pages_book` ON `pages` (`book_id`,`position`);--> statement-breakpoint
CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `series_owner` ON `series` (`owner_id`);--> statement-breakpoint
CREATE TABLE `thumbnails` (
	`book_id` text NOT NULL,
	`slot` integer NOT NULL,
	`prompt` text NOT NULL,
	`image_key` text,
	PRIMARY KEY(`book_id`, `slot`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
