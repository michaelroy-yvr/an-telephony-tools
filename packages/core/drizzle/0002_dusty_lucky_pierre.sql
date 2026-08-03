CREATE TYPE "public"."sms_mode" AS ENUM('mock', 'live');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"sms_mode" "sms_mode" DEFAULT 'mock' NOT NULL,
	"action_network_last_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "campaign_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "contact_id" DROP NOT NULL;