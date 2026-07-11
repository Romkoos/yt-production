CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`repo_url` text NOT NULL,
	`title` text,
	`verdict` text,
	`current_phase` text DEFAULT 'scout' NOT NULL,
	`youtube_video_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `phase_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`episode_id` text NOT NULL,
	`phase` text NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`duration_s` integer,
	`iterations` integer,
	`notes` text,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE no action
);
