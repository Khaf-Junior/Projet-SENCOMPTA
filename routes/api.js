const express = require('express');

module.exports = function(getDbConnection) {
    const router = express.Router();

    // Données utilisateur
    router.get('/user-data', async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Non autorisé' });
        }

        try {
            const conn = await getDbConnection();
            const [rows] = await conn.execute(
                'SELECT nom, prenom, email, abonnement, mode_sombre FROM utilisateurs WHERE id = ?',
                [req.session.user.id]
            );
            conn.end();

            if (rows.length === 0) {
                return res.status(404).json({ message: 'Utilisateur non trouvé' });
            }

            res.json(rows[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Erreur du serveur' });
        }
    });

    // Données du dashboard
    router.get('/dashboard-data', async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Non autorisé' });
        }

        try {
            const conn = await getDbConnection();
            
            // Produits totaux
            const [products] = await conn.execute(
                'SELECT COUNT(*) as total FROM produits WHERE utilisateur_id = ?',
                [req.session.user.id]
            );
            
            // Ventes aujourd'hui
            const [sales] = await conn.execute(
                'SELECT COUNT(*) as total FROM ventes WHERE utilisateur_id = ? AND DATE(date_vente) = CURDATE()',
                [req.session.user.id]
            );
            
            // Produits à faible stock
            const [lowStock] = await conn.execute(
                'SELECT * FROM produits WHERE utilisateur_id = ? AND quantite <= seuil_alerte ORDER BY quantite ASC LIMIT 10',
                [req.session.user.id]
            );
            
            // Ventes récentes
            const [recentSales] = await conn.execute(
                'SELECT p.nom, v.quantite, v.prix_unitaire, v.date_vente ' +
                'FROM ventes v JOIN produits p ON v.produit_id = p.id ' +
                'WHERE v.utilisateur_id = ? ORDER BY v.date_vente DESC LIMIT 5',
                [req.session.user.id]
            );
            
            conn.end();

            res.json({
                totalProducts: products[0].total,
                todaySales: sales[0].total,
                alertsCount: lowStock.length,
                lowStockProducts: lowStock,
                recentSales: recentSales
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Erreur du serveur' });
        }
    });

    // Données du dashboard Pro
router.get('/pro-dashboard-data', async (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'pro') {
        return res.status(403).json({ message: 'Accès non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        
        // Chiffre d'affaires des 30 derniers jours
        const [revenue] = await conn.execute(
            `SELECT SUM(v.quantite * v.prix_unitaire) as total 
             FROM ventes v 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
            [req.session.user.id]
        );
        
        // Bénéfices des 30 derniers jours
        const [profit] = await conn.execute(
            `SELECT SUM(v.quantite * (v.prix_unitaire - p.prix_achat)) as total 
             FROM ventes v 
             JOIN produits p ON v.produit_id = p.id 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
            [req.session.user.id]
        );
        
        // Comparaison avec la période précédente
        const [prevRevenue] = await conn.execute(
            `SELECT SUM(v.quantite * v.prix_unitaire) as total 
             FROM ventes v 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) 
             AND v.date_vente < DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
            [req.session.user.id]
        );
        
        // Produits totaux
        const [products] = await conn.execute(
            'SELECT COUNT(*) as total FROM produits WHERE utilisateur_id = ?',
            [req.session.user.id]
        );
        
        // Collaborateurs
        const [collaborators] = await conn.execute(
            'SELECT COUNT(*) as total FROM collaborateurs WHERE utilisateur_principal_id = ?',
            [req.session.user.id]
        );
        
        // Meilleurs produits
        const [topProducts] = await conn.execute(
            `SELECT p.nom, SUM(v.quantite) as total_ventes, SUM(v.quantite * v.prix_unitaire) as chiffre_affaire 
             FROM ventes v 
             JOIN produits p ON v.produit_id = p.id 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) 
             GROUP BY v.produit_id 
             ORDER BY total_ventes DESC 
             LIMIT 5`,
            [req.session.user.id]
        );
        
        // Alertes récentes
        const [alerts] = await conn.execute(
            `SELECT 'stock' as type, CONCAT('Stock faible pour ', p.nom) as message, NOW() as date 
             FROM produits p 
             WHERE p.utilisateur_id = ? AND p.quantite <= p.seuil_alerte 
             UNION
             SELECT 'peremption' as type, CONCAT('Produit ', p.nom, ' périmé le ', p.date_peremption) as message, NOW() as date 
             FROM produits p 
             WHERE p.utilisateur_id = ? AND p.date_peremption <= CURDATE() 
             ORDER BY date DESC 
             LIMIT 5`,
            [req.session.user.id, req.session.user.id]
        );
        
        // Données pour le graphique
        const [salesData] = await conn.execute(
            `SELECT DATE_FORMAT(v.date_vente, '%Y-%m-%d') as date, 
                    SUM(v.quantite * v.prix_unitaire) as revenue,
                    SUM(v.quantite * (v.prix_unitaire - p.prix_achat)) as profit
             FROM ventes v 
             JOIN produits p ON v.produit_id = p.id 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) 
             GROUP BY DATE(v.date_vente) 
             ORDER BY v.date_vente`,
            [req.session.user.id]
        );
        
        conn.end();

        // Calculer les pourcentages de changement
        const monthlyRevenue = revenue[0].total || 0;
        const prevMonthlyRevenue = prevRevenue[0].total || 0;
        const revenueChange = prevMonthlyRevenue > 0 
            ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100 
            : 0;
        
        const monthlyProfit = profit[0].total || 0;
        const prevProfit = await calculatePreviousProfit(conn, req.session.user.id); // Fonction à implémenter
        const profitChange = prevProfit > 0 
            ? ((monthlyProfit - prevProfit) / prevProfit) * 100 
            : 0;

        res.json({
            monthlyRevenue,
            monthlyProfit,
            revenueChange,
            profitChange,
            totalProducts: products[0].total,
            totalCollaborators: collaborators[0].total,
            topProducts,
            recentAlerts: alerts,
            salesData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Données du dashboard Premium
router.get('/premium-dashboard-data', async (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'premium') {
        return res.status(403).json({ message: 'Accès non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        
        // Récupérer toutes les données du dashboard Pro
        const proData = await getProDashboardData(conn, req.session.user.id);
        
        // Données supplémentaires pour Premium
        // Marge moyenne
        const [margin] = await conn.execute(
            `SELECT AVG((v.prix_unitaire - p.prix_achat) / v.prix_unitaire * 100) as marge 
             FROM ventes v 
             JOIN produits p ON v.produit_id = p.id 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
            [req.session.user.id]
        );
        
        // Ventes par catégorie (supposons qu'il y ait une colonne 'categorie' dans la table produits)
        const [categoryData] = await conn.execute(
            `SELECT p.categorie, SUM(v.quantite) as ventes 
             FROM ventes v 
             JOIN produits p ON v.produit_id = p.id 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) 
             GROUP BY p.categorie`,
            [req.session.user.id]
        );
        
        // Évolution des marges sur 6 mois
        const [marginData] = await conn.execute(
            `SELECT DATE_FORMAT(v.date_vente, '%Y-%m') as mois, 
                    AVG((v.prix_unitaire - p.prix_achat) / v.prix_unitaire * 100) as marge 
             FROM ventes v 
             JOIN produits p ON v.produit_id = p.id 
             WHERE v.utilisateur_id = ? 
             AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
             GROUP BY DATE_FORMAT(v.date_vente, '%Y-%m') 
             ORDER BY mois`,
            [req.session.user.id]
        );
        
        // Collaborateurs
        const [collaborators] = await conn.execute(
            'SELECT COUNT(*) as total FROM collaborateurs WHERE utilisateur_principal_id = ?',
            [req.session.user.id]
        );
        
        conn.end();

        res.json({
            ...proData,
            averageMargin: margin[0].marge ? parseFloat(margin[0].marge.toFixed(2)) : 0,
            categoryData,
            marginData,
            totalCollaborators: collaborators[0].total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Assistant IA (simplifié)
router.post('/ai-assistant', async (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'premium') {
        return res.status(403).json({ message: 'Cette fonctionnalité est réservée aux abonnés Premium' });
    }

    try {
        const { question } = req.body;
        
        // En production, vous intégrerez une vraie API IA comme OpenAI
        // Ceci est une simulation basique
        const responses = [
            "D'après vos données récentes, vos ventes sont en hausse de 15% par rapport au mois dernier.",
            "Votre produit le plus vendu ce mois-ci est le téléphone XYZ avec 120 unités vendues.",
            "Vous avez actuellement 3 produits avec un stock critique qui nécessitent une réapprovisionnement.",
            "Votre marge moyenne est de 32%, ce qui est supérieur à la moyenne du secteur."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        res.json({
            response: randomResponse
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Gestion des produits
router.get('/products', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        const [rows] = await conn.execute(
            'SELECT * FROM produits WHERE utilisateur_id = ? ORDER BY nom',
            [req.session.user.id]
        );
        conn.end();

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.get('/products/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        const [rows] = await conn.execute(
            'SELECT * FROM produits WHERE id = ? AND utilisateur_id = ?',
            [req.params.id, req.session.user.id]
        );
        conn.end();

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.post('/products', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { nom, code_barre, quantite, categorie, prix_achat, prix_vente, seuil_alerte, date_peremption, description } = req.body;
        const conn = await getDbConnection();
        
        const [result] = await conn.execute(
            `INSERT INTO produits 
             (utilisateur_id, nom, code_barre, quantite, categorie, prix_achat, prix_vente, seuil_alerte, date_peremption, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.session.user.id, nom, code_barre, quantite, categorie, prix_achat, prix_vente, seuil_alerte, date_peremption, description]
        );
        
        conn.end();

        res.json({ 
            success: true, 
            id: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/products', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { id, nom, code_barre, quantite, categorie, prix_achat, prix_vente, seuil_alerte, date_peremption, description } = req.body;
        const conn = await getDbConnection();
        
        await conn.execute(
            `UPDATE produits SET 
             nom = ?, code_barre = ?, quantite = ?, categorie = ?, 
             prix_achat = ?, prix_vente = ?, seuil_alerte = ?, 
             date_peremption = ?, description = ? 
             WHERE id = ? AND utilisateur_id = ?`,
            [nom, code_barre, quantite, categorie, prix_achat, prix_vente, seuil_alerte, date_peremption, description, id, req.session.user.id]
        );
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.delete('/products/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        await conn.execute(
            'DELETE FROM produits WHERE id = ? AND utilisateur_id = ?',
            [req.params.id, req.session.user.id]
        );
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Gestion des ventes
router.get('/sales', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { start, end } = req.query;
        const conn = await getDbConnection();
        
        let query = `
            SELECT v.*, p.nom as product_name 
            FROM ventes v 
            JOIN produits p ON v.produit_id = p.id 
            WHERE v.utilisateur_id = ?
        `;
        
        const params = [req.session.user.id];
        
        if (start && end) {
            query += ' AND DATE(v.date_vente) BETWEEN ? AND ?';
            params.push(start, end);
        }
        
        query += ' ORDER BY v.date_vente DESC';
        
        const [rows] = await conn.execute(query, params);
        conn.end();

        // Grouper par vente
        const sales = {};
        rows.forEach(row => {
            if (!sales[row.id_vente]) {
                sales[row.id_vente] = {
                    id: row.id_vente,
                    date_vente: row.date_vente,
                    items: []
                };
            }
            sales[row.id_vente].items.push({
                productId: row.produit_id,
                nom: row.product_name,
                quantite: row.quantite,
                prix_unitaire: row.prix_unitaire
            });
        });

        res.json(Object.values(sales));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.post('/sales', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { items, discount } = req.body;
        const conn = await getDbConnection();
        
        // Créer une nouvelle vente
        const [saleResult] = await conn.execute(
            'INSERT INTO ventes (utilisateur_id, remise) VALUES (?, ?)',
            [req.session.user.id, discount || 0]
        );
        
        const saleId = saleResult.insertId;
        
        // Ajouter les items de la vente
        for (const item of items) {
            await conn.execute(
                'INSERT INTO ventes_items (id_vente, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)',
                [saleId, item.productId, item.quantity, item.price]
            );
            
            // Mettre à jour le stock
            await conn.execute(
                'UPDATE produits SET quantite = quantite - ? WHERE id = ? AND utilisateur_id = ?',
                [item.quantity, item.productId, req.session.user.id]
            );
        }
        
        conn.end();

        res.json({ 
            success: true, 
            saleId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Gestion des alertes
router.get('/alerts', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        
        // Alertes de stock faible
        const [lowStock] = await conn.execute(
            `SELECT p.*, a.id as alert_id, a.date 
             FROM produits p 
             JOIN alertes a ON p.id = a.produit_id 
             WHERE p.utilisateur_id = ? 
             AND a.type = 'stock' 
             AND a.resolved = 0 
             AND p.quantite <= p.seuil_alerte`,
            [req.session.user.id]
        );
        
        // Alertes de péremption
        const [expiry] = await conn.execute(
            `SELECT p.*, a.id as alert_id, a.date, 
                    DATEDIFF(p.date_peremption, CURDATE()) as days_left 
             FROM produits p 
             JOIN alertes a ON p.id = a.produit_id 
             WHERE p.utilisateur_id = ? 
             AND a.type = 'peremption' 
             AND a.resolved = 0 
             AND p.date_peremption IS NOT NULL`,
            [req.session.user.id]
        );
        
        conn.end();

        // Formater les alertes de péremption
        const expiryAlerts = expiry.map(item => ({
            id: item.alert_id,
            date: item.date,
            product: {
                id: item.id,
                nom: item.nom,
                date_peremption: item.date_peremption
            },
            daysLeft: item.days_left,
            isExpired: item.days_left < 0
        }));

        res.json({
            lowStock: lowStock.map(item => ({
                id: item.alert_id,
                date: item.date,
                product: {
                    id: item.id,
                    nom: item.nom,
                    quantite: item.quantite,
                    seuil_alerte: item.seuil_alerte
                }
            })),
            expiry: expiryAlerts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/alerts/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { type, action } = req.body;
        const conn = await getDbConnection();
        
        if (action === 'resolve') {
            await conn.execute(
                'UPDATE alertes SET resolved = 1 WHERE id = ?',
                [req.params.id]
            );
        } else if (action === 'ignore') {
            await conn.execute(
                'DELETE FROM alertes WHERE id = ?',
                [req.params.id]
            );
        }
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Gestion des collaborateurs
router.get('/collaborators', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        const [rows] = await conn.execute(
            'SELECT * FROM collaborateurs WHERE utilisateur_principal_id = ?',
            [req.session.user.id]
        );
        conn.end();

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.post('/collaborators', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { nom, email, role } = req.body;
        const conn = await getDbConnection();
        
        // Vérifier si l'email est déjà utilisé
        const [existing] = await conn.execute(
            'SELECT id FROM collaborateurs WHERE email = ?',
            [email]
        );
        
        if (existing.length > 0) {
            conn.end();
            return res.status(400).json({ message: 'Cet email est déjà utilisé' });
        }
        
        // Créer le collaborateur
        const [result] = await conn.execute(
            'INSERT INTO collaborateurs (utilisateur_principal_id, email, nom, role) VALUES (?, ?, ?, ?)',
            [req.session.user.id, email, nom, role]
        );
        
        // Envoyer un email d'invitation (simulé)
        sendCollaboratorInvitation(email, req.session.user.nom);
        
        conn.end();

        res.json({ 
            success: true, 
            id: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/collaborators', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { id, nom, email, role } = req.body;
        const conn = await getDbConnection();
        
        await conn.execute(
            'UPDATE collaborateurs SET nom = ?, email = ?, role = ? WHERE id = ? AND utilisateur_principal_id = ?',
            [nom, email, role, id, req.session.user.id]
        );
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.delete('/collaborators/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        await conn.execute(
            'DELETE FROM collaborateurs WHERE id = ? AND utilisateur_principal_id = ?',
            [req.params.id, req.session.user.id]
        );
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Gestion des dettes
router.get('/debts', async (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'premium') {
        return res.status(403).json({ message: 'Cette fonctionnalité est réservée aux abonnés Premium' });
    }

    try {
        const { status } = req.query;
        const conn = await getDbConnection();
        
        let query = 'SELECT * FROM dettes WHERE utilisateur_id = ?';
        const params = [req.session.user.id];
        
        if (status === 'paid') {
            query += ' AND paid = 1';
        } else if (status === 'pending') {
            query += ' AND paid = 0 AND due_date >= CURDATE()';
        } else if (status === 'overdue') {
            query += ' AND paid = 0 AND due_date < CURDATE()';
        }
        
        query += ' ORDER BY due_date';
        
        const [rows] = await conn.execute(query, params);
        conn.end();

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.post('/debts', async (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'premium') {
        return res.status(403).json({ message: 'Cette fonctionnalité est réservée aux abonnés Premium' });
    }

    try {
        const { client, amount, date, dueDate, description } = req.body;
        const conn = await getDbConnection();
        
        const [result] = await conn.execute(
            'INSERT INTO dettes (utilisateur_id, client, amount, date, due_date, description) VALUES (?, ?, ?, ?, ?, ?)',
            [req.session.user.id, client, amount, date, dueDate, description]
        );
        
        conn.end();

        res.json({ 
            success: true, 
            id: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/debts/:id/payment', async (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'premium') {
        return res.status(403).json({ message: 'Cette fonctionnalité est réservée aux abonnés Premium' });
    }

    try {
        const { paid } = req.body;
        const conn = await getDbConnection();
        
        await conn.execute(
            'UPDATE dettes SET paid = ? WHERE id = ? AND utilisateur_id = ?',
            [paid ? 1 : 0, req.params.id, req.session.user.id]
        );
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.delete('/debts/:id', async (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'premium') {
        return res.status(403).json({ message: 'Cette fonctionnalité est réservée aux abonnés Premium' });
    }

    try {
        const conn = await getDbConnection();
        await conn.execute(
            'DELETE FROM dettes WHERE id = ? AND utilisateur_id = ?',
            [req.params.id, req.session.user.id]
        );
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Paramètres utilisateur
router.get('/user-settings', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const conn = await getDbConnection();
        
        // Informations de base
        const [user] = await conn.execute(
            'SELECT nom, prenom, email, telephone, abonnement, mode_sombre FROM utilisateurs WHERE id = ?',
            [req.session.user.id]
        );
        
        // Préférences de notification
        const [prefs] = await conn.execute(
            'SELECT email_notifications, sms_notifications, notification_frequency FROM user_preferences WHERE user_id = ?',
            [req.session.user.id]
        );
        
        // Informations commerciales
        const [business] = await conn.execute(
            'SELECT business_name, business_type, business_address, business_city, business_country FROM user_business WHERE user_id = ?',
            [req.session.user.id]
        );
        
        // Méthodes de paiement
        const [paymentMethods] = await conn.execute(
            'SELECT id, type, last4, number FROM payment_methods WHERE user_id = ?',
            [req.session.user.id]
        );
        
        conn.end();

        res.json({
            ...user[0],
            ...(prefs[0] || {}),
            ...(business[0] || {}),
            payment_methods: paymentMethods,
            next_billing_date: req.session.user.abonnement === 'standard' ? null : 
                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 jours
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Modifiez la route /sales dans api.js comme suit :

router.get('/sales', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { start, end } = req.query;
        const conn = await getDbConnection();
        
        // Requête modifiée pour mieux gérer les ventes
        const [sales] = await conn.execute(
            `SELECT 
                v.id as sale_id,
                v.date_vente,
                p.nom as product_name,
                v.quantite,
                v.prix_unitaire,
                (v.quantite * v.prix_unitaire) as total
             FROM ventes v
             JOIN produits p ON v.produit_id = p.id
             WHERE v.utilisateur_id = ?
             ${start && end ? 'AND DATE(v.date_vente) BETWEEN ? AND ?' : ''}
             ORDER BY v.date_vente DESC`,
            [req.session.user.id, ...(start && end ? [start, end] : [])]
        );
        
        conn.end();

        // Nouveau format de réponse plus simple
        res.json(sales);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/user-settings/profile', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { nom, prenom, email, telephone } = req.body;
        const conn = await getDbConnection();
        
        // Vérifier si l'email est déjà utilisé
        if (email !== req.session.user.email) {
            const [existing] = await conn.execute(
                'SELECT id FROM utilisateurs WHERE email = ? AND id != ?',
                [email, req.session.user.id]
            );
            
            if (existing.length > 0) {
                conn.end();
                return res.status(400).json({ message: 'Cet email est déjà utilisé' });
            }
        }
        
        await conn.execute(
            'UPDATE utilisateurs SET nom = ?, prenom = ?, email = ?, telephone = ? WHERE id = ?',
            [nom, prenom, email, telephone, req.session.user.id]
        );
        
        // Mettre à jour la session
        req.session.user.nom = nom;
        req.session.user.prenom = prenom;
        req.session.user.email = email;
        req.session.user.telephone = telephone;
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/user-settings/password', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { currentPassword, newPassword } = req.body;
        const conn = await getDbConnection();
        
        // Vérifier le mot de passe actuel
        const [user] = await conn.execute(
            'SELECT mot_de_passe FROM utilisateurs WHERE id = ?',
            [req.session.user.id]
        );
        
        const isValid = await bcrypt.compare(currentPassword, user[0].mot_de_passe);
        
        if (!isValid) {
            conn.end();
            return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
        }
        
        // Hasher le nouveau mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Mettre à jour le mot de passe
        await conn.execute(
            'UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?',
            [hashedPassword, req.session.user.id]
        );
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/user-settings/notifications', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { emailNotifications, smsNotifications, notificationFrequency } = req.body;
        const conn = await getDbConnection();
        
        // Vérifier si des préférences existent déjà
        const [existing] = await conn.execute(
            'SELECT id FROM user_preferences WHERE user_id = ?',
            [req.session.user.id]
        );
        
        if (existing.length > 0) {
            await conn.execute(
                `UPDATE user_preferences SET 
                 email_notifications = ?, sms_notifications = ?, notification_frequency = ? 
                 WHERE user_id = ?`,
                [emailNotifications, smsNotifications, notificationFrequency, req.session.user.id]
            );
        } else {
            await conn.execute(
                `INSERT INTO user_preferences 
                 (user_id, email_notifications, sms_notifications, notification_frequency) 
                 VALUES (?, ?, ?, ?)`,
                [req.session.user.id, emailNotifications, smsNotifications, notificationFrequency]
            );
        }
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

router.put('/user-settings/business', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { businessName, businessType, businessAddress, businessCity, businessCountry } = req.body;
        const conn = await getDbConnection();
        
        // Vérifier si des infos commerciales existent déjà
        const [existing] = await conn.execute(
            'SELECT id FROM user_business WHERE user_id = ?',
            [req.session.user.id]
        );
        
        if (existing.length > 0) {
            await conn.execute(
                `UPDATE user_business SET 
                 business_name = ?, business_type = ?, business_address = ?, 
                 business_city = ?, business_country = ? 
                 WHERE user_id = ?`,
                [businessName, businessType, businessAddress, businessCity, businessCountry, req.session.user.id]
            );
        } else {
            await conn.execute(
                `INSERT INTO user_business 
                 (user_id, business_name, business_type, business_address, business_city, business_country) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.session.user.id, businessName, businessType, businessAddress, businessCity, businessCountry]
            );
        }
        
        conn.end();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Mise à niveau d'abonnement
router.post('/upgrade', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { plan, payment } = req.body;
        
        // Valider le plan
        if (!['pro', 'premium'].includes(plan)) {
            return res.status(400).json({ message: 'Plan invalide' });
        }
        
        // Simuler le paiement
        const paymentSuccess = simulatePayment(payment);
        
        if (!paymentSuccess) {
            return res.status(400).json({ message: 'Paiement échoué' });
        }
        
        const conn = await getDbConnection();
        
        // Mettre à jour l'abonnement de l'utilisateur
        await conn.execute(
            'UPDATE utilisateurs SET abonnement = ? WHERE id = ?',
            [plan, req.session.user.id]
        );
        
        // Enregistrer le paiement
        await conn.execute(
            `INSERT INTO paiements 
             (utilisateur_id, montant, methode, numero_transaction, statut, type) 
             VALUES (?, ?, ?, ?, 'payé', 'abonnement')`,
            [
                req.session.user.id,
                plan === 'pro' ? 15000 : 30000,
                payment.method === 'card' ? 'carte' : payment.method,
                payment.number,
            ]
        );
        
        // Mettre à jour la session
        req.session.user.abonnement = plan;
        
        conn.end();

        res.json({ 
            success: true,
            redirectUrl: `/dashboard/${plan}`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Ajoutez ces fonctions avant les routes qui les utilisent (vers le début du fichier)

// Fonction pour calculer le bénéfice de la période précédente
async function calculatePreviousProfit(conn, userId) {
    const [result] = await conn.execute(
        `SELECT SUM(v.quantite * (v.prix_unitaire - p.prix_achat)) as profit 
         FROM ventes v 
         JOIN produits p ON v.produit_id = p.id 
         WHERE v.utilisateur_id = ? 
         AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) 
         AND v.date_vente < DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
        [userId]
    );
    return result[0]?.profit || 0;
}

// Fonction pour récupérer les données du dashboard Pro
async function getProDashboardData(conn, userId) {
    const [products] = await conn.execute(
        'SELECT COUNT(*) as total FROM produits WHERE utilisateur_id = ?',
        [userId]
    );
    
    const [sales] = await conn.execute(
        'SELECT COUNT(*) as total FROM ventes WHERE utilisateur_id = ? AND DATE(date_vente) = CURDATE()',
        [userId]
    );
    
    const [revenue] = await conn.execute(
        `SELECT SUM(v.quantite * v.prix_unitaire) as total 
         FROM ventes v 
         WHERE v.utilisateur_id = ? 
         AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
        [userId]
    );
    
    const [profit] = await conn.execute(
        `SELECT SUM(v.quantite * (v.prix_unitaire - p.prix_achat)) as total 
         FROM ventes v 
         JOIN produits p ON v.produit_id = p.id 
         WHERE v.utilisateur_id = ? 
         AND v.date_vente >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
        [userId]
    );
    
    const [collaborators] = await conn.execute(
        'SELECT COUNT(*) as total FROM collaborateurs WHERE utilisateur_principal_id = ?',
        [userId]
    );
    
    return {
        totalProducts: products[0].total,
        todaySales: sales[0].total,
        monthlyRevenue: revenue[0].total || 0,
        monthlyProfit: profit[0].total || 0,
        totalCollaborators: collaborators[0].total
    };
}
// Fonction utilitaire pour simuler un paiement
function simulatePayment(payment) {
    // En production, vous utiliseriez une vraie API de paiement
    // Ceci est une simulation basique
    
    if (payment.method === 'wave' || payment.method === 'orange_money') {
        return payment.number && payment.number.match(/^7[0-9]{8}$/);
    } else if (payment.method === 'card') {
        return payment.number && payment.number.match(/^[0-9]{16}$/) &&
               payment.expiry && payment.expiry.match(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/) &&
               payment.cvc && payment.cvc.match(/^[0-9]{3,4}$/);
    }
    
    return false;
}

// Fonction utilitaire pour envoyer une invitation (simulée)
function sendCollaboratorInvitation(email, inviterName) {
    console.log(`Envoi d'une invitation à ${email} par ${inviterName}`);
    // En production, vous enverriez un vrai email
}

    return router;
};

