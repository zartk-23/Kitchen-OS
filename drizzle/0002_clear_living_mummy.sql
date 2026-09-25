CREATE TABLE `recipe_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`recipeId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`contentType` varchar(32) NOT NULL,
	`byteSize` int NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recipe_photos_id` PRIMARY KEY(`id`),
	CONSTRAINT `recipe_photos_recipe_unique` UNIQUE(`recipeId`)
);
--> statement-breakpoint
ALTER TABLE `recipe_photos` ADD CONSTRAINT `recipe_photos_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_photos` ADD CONSTRAINT `recipe_photos_recipeId_recipes_id_fk` FOREIGN KEY (`recipeId`) REFERENCES `recipes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recipe_photos` ADD CONSTRAINT `recipe_photos_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `recipe_photos_tenant_idx` ON `recipe_photos` (`organizationId`);