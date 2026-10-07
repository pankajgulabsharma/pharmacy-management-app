CREATE UNIQUE INDEX `suppliers_gstin_uq` ON `suppliers` (`gstin`) WHERE "suppliers"."gstin" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_name_uq` ON `suppliers` (lower("name"));