-- Older data may have the same barcode on two medicines: keep it on the first, clear the rest
UPDATE `medicines` SET `barcode` = '' WHERE `barcode` <> '' AND rowid NOT IN (SELECT min(rowid) FROM `medicines` WHERE `barcode` <> '' GROUP BY `barcode`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicines_barcode_uq` ON `medicines` (`barcode`) WHERE "medicines"."barcode" <> '';
