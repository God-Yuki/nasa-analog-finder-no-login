-- schema.sql - cấu trúc database `railway` (chỉ CREATE TABLE IF NOT EXISTS, KHÔNG có dữ liệu / mật khẩu)
-- Server tự chạy file này mỗi lần khởi động (xem migrate.js). Yêu cầu MySQL 8.

-- Table: users
CREATE TABLE IF NOT EXISTS `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: data_types
CREATE TABLE IF NOT EXISTS `data_types` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `crit_key` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `range_min` decimal(14,4) NOT NULL,
  `range_max` decimal(14,4) NOT NULL,
  `direction` enum('higher','lower') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'higher',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_key` (`user_id`,`crit_key`),
  UNIQUE KEY `uq_user_name` (`user_id`,`name`),
  CONSTRAINT `data_types_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `data_types_chk_1` CHECK ((`range_max` > `range_min`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: map_layers
CREATE TABLE IF NOT EXISTS `map_layers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `preset` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_zoom` tinyint unsigned DEFAULT NULL,
  `mode` enum('overlay','base') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'overlay',
  `tile_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `map_layers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `map_layers_chk_1` CHECK (((`tile_url` like _utf8mb4'%{z}%') and (`tile_url` like _utf8mb4'%{x}%') and (`tile_url` like _utf8mb4'%{y}%')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: site_values
CREATE TABLE IF NOT EXISTS `site_values` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `base` enum('moon base','mars outpost') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `site_id` int unsigned NOT NULL,
  `data_type_id` int unsigned NOT NULL,
  `value` decimal(14,4) NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_site_type` (`user_id`,`base`,`site_id`,`data_type_id`),
  KEY `data_type_id` (`data_type_id`),
  CONSTRAINT `site_values_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `site_values_ibfk_2` FOREIGN KEY (`data_type_id`) REFERENCES `data_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: contributions
CREATE TABLE IF NOT EXISTS `contributions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `base` enum('moon base','mars outpost') NOT NULL,
  `site_name` varchar(100) NOT NULL,
  `country` varchar(100) NOT NULL,
  `latitude` decimal(9,6) NOT NULL,
  `longitude` decimal(9,6) NOT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `pop_density` decimal(10,2) DEFAULT NULL,
  `terrain` varchar(60) NOT NULL,
  `features` text NOT NULL,
  `contributor` varchar(100) NOT NULL,
  `ref_url` varchar(500) DEFAULT NULL,
  `score` tinyint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_base` (`base`),
  CONSTRAINT `contributions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contributions_chk_1` CHECK ((`latitude` between -(90) and 90)),
  CONSTRAINT `contributions_chk_2` CHECK ((`longitude` between -(180) and 180))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: moon_base_sites
CREATE TABLE IF NOT EXISTS `moon_base_sites` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned DEFAULT NULL,
  `Earth_Location` varchar(150) NOT NULL,
  `Latitude` decimal(9,6) DEFAULT NULL,
  `Longitude` decimal(9,6) DEFAULT NULL,
  `Humidity` decimal(5,2) DEFAULT NULL,
  `Pop_density` decimal(10,2) DEFAULT NULL,
  `Terrain` varchar(60) NOT NULL,
  `Temperature` decimal(6,2) DEFAULT NULL,
  `Wind_Speed` decimal(6,2) DEFAULT NULL,
  `Wind_Direction` decimal(5,2) DEFAULT NULL,
  `Pressure` decimal(8,2) DEFAULT NULL,
  `Elevation` decimal(9,2) DEFAULT NULL,
  `temperature_24h` varchar(255) DEFAULT NULL,
  `wind_speed_24h` varchar(255) DEFAULT NULL,
  `Geology_and_environment` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `contributor` varchar(100) DEFAULT NULL,
  `ref_url` varchar(500) DEFAULT NULL,
  `image` mediumtext,
  `score` tinyint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: mars_outpost_sites
CREATE TABLE IF NOT EXISTS `mars_outpost_sites` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned DEFAULT NULL,
  `Earth_Location` varchar(150) NOT NULL,
  `Latitude` decimal(9,6) DEFAULT NULL,
  `Longitude` decimal(9,6) DEFAULT NULL,
  `Humidity` decimal(5,2) DEFAULT NULL,
  `Pop_density` decimal(10,2) DEFAULT NULL,
  `Terrain` varchar(60) NOT NULL,
  `Temperature` decimal(6,2) DEFAULT NULL,
  `Wind_Speed` decimal(6,2) DEFAULT NULL,
  `Wind_Direction` decimal(5,2) DEFAULT NULL,
  `Pressure` decimal(8,2) DEFAULT NULL,
  `Elevation` decimal(9,2) DEFAULT NULL,
  `temperature_24h` varchar(255) DEFAULT NULL,
  `wind_speed_24h` varchar(255) DEFAULT NULL,
  `Geology_and_environment` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `contributor` varchar(100) DEFAULT NULL,
  `ref_url` varchar(500) DEFAULT NULL,
  `image` mediumtext,
  `score` tinyint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: analog_sites
CREATE TABLE IF NOT EXISTS `analog_sites` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned DEFAULT NULL,
  `role_type` enum('engineer','government','enterprise') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'engineer',
  `target_body` enum('Moon','Mars') COLLATE utf8mb4_unicode_ci NOT NULL,
  `location_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(9,6) DEFAULT NULL,
  `longitude` decimal(9,6) DEFAULT NULL,
  `wind_speed` decimal(8,2) DEFAULT NULL COMMENT 'Wind speed (km/h)',
  `wind_direction` decimal(6,2) DEFAULT NULL COMMENT 'Wind direction (0-360 degrees)',
  `pressure` decimal(8,2) DEFAULT NULL COMMENT 'Pressure (hPa)',
  `elevation` decimal(9,2) DEFAULT NULL COMMENT 'Elevation (m)',
  `hourly_temp` json DEFAULT NULL COMMENT '24h temperature (°C) - mảng 24 giá trị',
  `hourly_wind` json DEFAULT NULL COMMENT '24h wind speed (km/h) - mảng 24 giá trị',
  `terrain_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `features` text COLLATE utf8mb4_unicode_ci COMMENT 'Geology and environment (Optional - cho phép NULL)',
  `humidity` decimal(6,2) DEFAULT NULL COMMENT 'Relative humidity (%)',
  `pop_density` decimal(10,2) DEFAULT NULL COMMENT 'Population density (/km2)',
  `current_temp` decimal(6,2) DEFAULT NULL COMMENT 'Temperature (°C)',
  `analog_score` tinyint unsigned DEFAULT NULL COMMENT 'Điểm tổng hợp 0-100',
  `terrain_fidelity` tinyint unsigned DEFAULT NULL,
  `mineral_fidelity` tinyint unsigned DEFAULT NULL,
  `test_utility` tinyint unsigned DEFAULT NULL,
  `ai_report` mediumtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_site_target_role` (`location_name`,`target_body`,`role_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: site_extra_criteria
CREATE TABLE IF NOT EXISTS `site_extra_criteria` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `site_id` int unsigned NOT NULL,
  `criterion_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Mã tiêu chí: regolith_sim, slope_deg, humidity, custom_...',
  `criterion_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT '0-100',
  `better_direction` enum('high','low') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'high',
  `min_val` decimal(10,3) DEFAULT '0.000',
  `max_val` decimal(10,3) DEFAULT '100.000',
  `input_value` decimal(12,4) DEFAULT NULL,
  `normalized_score` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_site_criterion` (`site_id`,`criterion_key`),
  CONSTRAINT `fk_site_extra_criteria` FOREIGN KEY (`site_id`) REFERENCES `analog_sites` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: qgis_projects
CREATE TABLE IF NOT EXISTS `qgis_projects` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `layer_count` smallint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `qgis_projects_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: qgis_project_layers
CREATE TABLE IF NOT EXISTS `qgis_project_layers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int unsigned NOT NULL,
  `layer_name` varchar(255) NOT NULL,
  `source_file` varchar(255) DEFAULT NULL,
  `crit_key` varchar(40) DEFAULT NULL,
  `status` enum('ok','missing_tif','unknown_criterion','error') NOT NULL,
  `message` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`),
  CONSTRAINT `qgis_project_layers_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `qgis_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: tif_layers
CREATE TABLE IF NOT EXISTS `tif_layers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `crit_key` varchar(40) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `source` enum('tif','qgz') NOT NULL DEFAULT 'tif',
  `limit_min` decimal(14,4) NOT NULL,
  `limit_max` decimal(14,4) NOT NULL,
  `direction` enum('higher','lower') NOT NULL DEFAULT 'higher',
  `west` double DEFAULT NULL,
  `south` double DEFAULT NULL,
  `east` double DEFAULT NULL,
  `north` double DEFAULT NULL,
  `sites_total` smallint unsigned NOT NULL DEFAULT '0',
  `sites_scored` smallint unsigned NOT NULL DEFAULT '0',
  `sites_rejected` smallint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_crit` (`user_id`,`crit_key`),
  CONSTRAINT `tif_layers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tif_layers_chk_1` CHECK ((`limit_max` > `limit_min`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: tif_scores
CREATE TABLE IF NOT EXISTS `tif_scores` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `layer_id` int unsigned NOT NULL,
  `base` enum('moon base','mars outpost') NOT NULL,
  `site_id` int unsigned NOT NULL,
  `raw_value` decimal(14,4) DEFAULT NULL,
  `score` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_layer_site` (`layer_id`,`base`,`site_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `tif_scores_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tif_scores_ibfk_2` FOREIGN KEY (`layer_id`) REFERENCES `tif_layers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tif_scores_chk_1` CHECK (((`score` is null) or (`score` <= 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: sessions (lưu phiên đăng nhập trong MySQL để không mất khi server restart)
CREATE TABLE IF NOT EXISTS `sessions` (
  `sid` varchar(128) NOT NULL,
  `data` mediumtext NOT NULL,
  `expires_at` bigint unsigned NOT NULL,
  PRIMARY KEY (`sid`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
