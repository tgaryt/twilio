CREATE TABLE `clients` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`client_name` varchar(255) NOT NULL,
	`client_number` varchar(20) NOT NULL,
	`call_sid` varchar(255) DEFAULT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'away',
	`is_active` tinyint(1) NOT NULL DEFAULT 1,
	PRIMARY KEY (`id`),
	UNIQUE KEY `idx_client_name` (`client_name`),
	UNIQUE KEY `idx_client_number` (`client_number`),
	KEY `idx_call_sid` (`call_sid`),
	KEY `idx_status` (`status`),
	KEY `idx_is_active` (`is_active`)
);
