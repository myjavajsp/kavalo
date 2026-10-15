-- kavalo.top — articles table schema (idempotent, safe to re-run).
-- Mounted into MySQL's docker-entrypoint-initdb.d so it runs automatically
-- on first container start. Also usable via `npm run migrate`.

CREATE DATABASE IF NOT EXISTS kavalo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kavalo;

CREATE TABLE IF NOT EXISTS articles (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(255) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  category    VARCHAR(64)  NOT NULL,
  image       VARCHAR(512) DEFAULT NULL,
  description TEXT,
  body        LONGTEXT     NOT NULL,
  read_time   VARCHAR(32)  DEFAULT NULL,
  tests       JSON         DEFAULT NULL,
  pub_date    DATETIME     NOT NULL,
  published   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_slug (slug),
  KEY idx_category (category),
  KEY idx_pub_date (pub_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
