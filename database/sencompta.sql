-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : mer. 04 juin 2025 à 19:44
-- Version du serveur : 9.1.0
-- Version de PHP : 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `sencompta`
--

-- --------------------------------------------------------

--
-- Structure de la table `alertes`
--

DROP TABLE IF EXISTS `alertes`;
CREATE TABLE IF NOT EXISTS `alertes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_id` int NOT NULL,
  `produit_id` int NOT NULL,
  `type` enum('stock','peremption') NOT NULL,
  `date` datetime DEFAULT CURRENT_TIMESTAMP,
  `resolved` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`),
  KEY `produit_id` (`produit_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `collaborateurs`
--

DROP TABLE IF EXISTS `collaborateurs`;
CREATE TABLE IF NOT EXISTS `collaborateurs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_principal_id` int NOT NULL,
  `email` varchar(100) NOT NULL,
  `nom` varchar(50) NOT NULL,
  `prenom` varchar(50) NOT NULL,
  `role` enum('lecture','edition','admin') NOT NULL,
  `date_ajout` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `utilisateur_principal_id` (`utilisateur_principal_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `dettes`
--

DROP TABLE IF EXISTS `dettes`;
CREATE TABLE IF NOT EXISTS `dettes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_id` int NOT NULL,
  `client` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `date` date NOT NULL,
  `due_date` date NOT NULL,
  `description` text,
  `paid` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `paiements`
--

DROP TABLE IF EXISTS `paiements`;
CREATE TABLE IF NOT EXISTS `paiements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_id` int NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `methode` enum('wave','orange_money','carte') NOT NULL,
  `numero_transaction` varchar(100) NOT NULL,
  `date_paiement` datetime DEFAULT CURRENT_TIMESTAMP,
  `statut` enum('en_attente','payé','échoué') DEFAULT 'en_attente',
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` enum('card','wave','orange_money') NOT NULL,
  `last4` char(4) DEFAULT NULL,
  `number` varchar(100) NOT NULL,
  `expiry` varchar(10) DEFAULT NULL,
  `date_added` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `produits`
--

DROP TABLE IF EXISTS `produits`;
CREATE TABLE IF NOT EXISTS `produits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_id` int NOT NULL,
  `nom` varchar(100) NOT NULL,
  `description` text,
  `quantite` int NOT NULL,
  `prix_achat` decimal(10,2) NOT NULL,
  `prix_vente` decimal(10,2) NOT NULL,
  `code_barre` varchar(50) DEFAULT NULL,
  `date_peremption` date DEFAULT NULL,
  `seuil_alerte` int DEFAULT '5',
  `categorie` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `produits`
--

INSERT INTO `produits` (`id`, `utilisateur_id`, `nom`, `description`, `quantite`, `prix_achat`, `prix_vente`, `code_barre`, `date_peremption`, `seuil_alerte`, `categorie`) VALUES
(1, 2, 'Cahier 150 pages', 'Cahier de 150 pages pour des enfants à l\'ouverture de l\'école', 8, 250.00, 300.00, '', '0000-00-00', 5, 'Papier'),
(2, 1, 'Ordinateur MacBook Pro', 'Mac book pro originale pour du bon travail', 1, 3000000.00, 3500000.00, '', '0000-00-00', 5, 'Apple');

-- --------------------------------------------------------

--
-- Structure de la table `user_business`
--

DROP TABLE IF EXISTS `user_business`;
CREATE TABLE IF NOT EXISTS `user_business` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `business_name` varchar(100) DEFAULT NULL,
  `business_type` varchar(100) DEFAULT NULL,
  `business_address` text,
  `business_city` varchar(50) DEFAULT NULL,
  `business_country` varchar(50) DEFAULT 'Sénégal',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `user_preferences`
--

DROP TABLE IF EXISTS `user_preferences`;
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `email_notifications` tinyint(1) DEFAULT '1',
  `sms_notifications` tinyint(1) DEFAULT '0',
  `notification_frequency` enum('daily','weekly','monthly') DEFAULT 'weekly',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `utilisateurs`
--

DROP TABLE IF EXISTS `utilisateurs`;
CREATE TABLE IF NOT EXISTS `utilisateurs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(50) NOT NULL,
  `prenom` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `mot_de_passe` varchar(255) NOT NULL,
  `telephone` varchar(20) DEFAULT NULL,
  `abonnement` enum('standard','pro','premium') DEFAULT 'standard',
  `date_inscription` datetime DEFAULT CURRENT_TIMESTAMP,
  `est_actif` tinyint(1) DEFAULT '1',
  `mode_sombre` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `utilisateurs`
--

INSERT INTO `utilisateurs` (`id`, `nom`, `prenom`, `email`, `mot_de_passe`, `telephone`, `abonnement`, `date_inscription`, `est_actif`, `mode_sombre`) VALUES
(1, 'MBAYE', 'Pape Ibrahima', 'papeibrahimambaye888@gmail.com', '$2b$10$QqB8j2J/CkthCgWrRpa03.eNbHx4yfVhrWeKthrSmEUZ4ib3/XUs6', '784886538', 'standard', '2025-06-03 15:26:21', 1, 1),
(2, 'THIAM', 'Pa Assane', 'assanethiam@gmail.com', '$2y$10$Xp91iAR92CwOAVqDUU3FLuEut6m4Gbe47E2z9oE.5DoO5qyStuBUG', '784886538', 'pro', '2025-06-03 21:19:07', 1, 1),
(3, 'DIA', 'Adja Charlotte', 'charlottedia@gmail.com', '$2y$10$Xp91iAR92CwOAVqDUU3FLuEut6m4Gbe47E2z9oE.5DoO5qyStuBUG', '772333678', 'premium', '2025-06-03 21:20:30', 1, 1);

-- --------------------------------------------------------

--
-- Structure de la table `ventes`
--

DROP TABLE IF EXISTS `ventes`;
CREATE TABLE IF NOT EXISTS `ventes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `utilisateur_id` int NOT NULL,
  `produit_id` int NOT NULL,
  `quantite` int NOT NULL,
  `prix_unitaire` decimal(10,2) NOT NULL,
  `date_vente` datetime DEFAULT CURRENT_TIMESTAMP,
  `remise` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`),
  KEY `produit_id` (`produit_id`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `ventes`
--

INSERT INTO `ventes` (`id`, `utilisateur_id`, `produit_id`, `quantite`, `prix_unitaire`, `date_vente`, `remise`) VALUES
(5, 1, 0, 0, 0.00, '2025-06-04 19:19:54', 0.00);

-- --------------------------------------------------------

--
-- Structure de la table `ventes_items`
--

DROP TABLE IF EXISTS `ventes_items`;
CREATE TABLE IF NOT EXISTS `ventes_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_vente` int NOT NULL,
  `produit_id` int NOT NULL,
  `quantite` int NOT NULL,
  `prix_unitaire` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `produit_id` (`produit_id`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `ventes_items`
--

INSERT INTO `ventes_items` (`id`, `id_vente`, `produit_id`, `quantite`, `prix_unitaire`) VALUES
(5, 5, 2, 2, 3500000.00);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
