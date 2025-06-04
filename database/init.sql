-- Création de la base de données
CREATE DATABASE IF NOT EXISTS SENCOMPTA;
USE SENCOMPTA;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS utilisateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    prenom VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    mot_de_passe VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    abonnement ENUM('standard', 'pro', 'premium') DEFAULT 'standard',
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
    est_actif BOOLEAN DEFAULT TRUE,
    mode_sombre BOOLEAN DEFAULT FALSE
);

-- Table des paiements
CREATE TABLE IF NOT EXISTS paiements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    montant DECIMAL(10, 2) NOT NULL,
    methode ENUM('wave', 'orange_money', 'carte') NOT NULL,
    numero_transaction VARCHAR(100) NOT NULL,
    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('en_attente', 'payé', 'échoué') DEFAULT 'en_attente',
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- Table des produits
CREATE TABLE IF NOT EXISTS produits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    quantite INT NOT NULL,
    prix_achat DECIMAL(10, 2) NOT NULL,
    prix_vente DECIMAL(10, 2) NOT NULL,
    code_barre VARCHAR(50),
    date_peremption DATE,
    seuil_alerte INT DEFAULT 5,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- Table des ventes
CREATE TABLE IF NOT EXISTS ventes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    produit_id INT NOT NULL,
    quantite INT NOT NULL,
    prix_unitaire DECIMAL(10, 2) NOT NULL,
    date_vente DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (produit_id) REFERENCES produits(id)
);

-- Table des collaborateurs
CREATE TABLE IF NOT EXISTS collaborateurs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_principal_id INT NOT NULL,
    email VARCHAR(100) NOT NULL,
    nom VARCHAR(50) NOT NULL,
    prenom VARCHAR(50) NOT NULL,
    role ENUM('lecture', 'edition', 'admin') NOT NULL,
    date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_principal_id) REFERENCES utilisateurs(id)
);

-- Table des alertes
CREATE TABLE IF NOT EXISTS alertes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    produit_id INT NOT NULL,
    type ENUM('stock', 'peremption') NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    FOREIGN KEY (produit_id) REFERENCES produits(id)
);

-- Table des ventes (extension)
CREATE TABLE IF NOT EXISTS ventes_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_vente INT NOT NULL,
    produit_id INT NOT NULL,
    quantite INT NOT NULL,
    prix_unitaire DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (produit_id) REFERENCES produits(id)
);

-- Table des dettes
CREATE TABLE IF NOT EXISTS dettes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    client VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    description TEXT,
    paid BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
);

-- Préférences utilisateur
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    notification_frequency ENUM('daily', 'weekly', 'monthly') DEFAULT 'weekly',
    FOREIGN KEY (user_id) REFERENCES utilisateurs(id)
);

-- Informations commerciales
CREATE TABLE IF NOT EXISTS user_business (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    business_name VARCHAR(100),
    business_type VARCHAR(100),
    business_address TEXT,
    business_city VARCHAR(50),
    business_country VARCHAR(50) DEFAULT 'Sénégal',
    FOREIGN KEY (user_id) REFERENCES utilisateurs(id)
);

-- Méthodes de paiement
CREATE TABLE IF NOT EXISTS payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('card', 'wave', 'orange_money') NOT NULL,
    last4 CHAR(4),
    number VARCHAR(100) NOT NULL,
    expiry VARCHAR(10),
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES utilisateurs(id)
);
