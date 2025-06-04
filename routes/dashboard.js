const express = require('express');
const path = require('path');

module.exports = function(getDbConnection) {
    const router = express.Router();

    // Middleware pour vérifier l'authentification
    router.use((req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/connexion');
        }
        next();
    });

    // Dashboard Standard
    router.get('/standard', async (req, res) => {
        if (req.session.user.abonnement !== 'standard') {
            return res.redirect(`/dashboard/${req.session.user.abonnement}`);
        }
        
        try {
            const conn = await getDbConnection();
            const [produits] = await conn.execute(
                'SELECT * FROM produits WHERE utilisateur_id = ? ORDER BY quantite ASC LIMIT 200',
                [req.session.user.id]
            );
            conn.end();

            res.sendFile(path.join(__dirname, '../views/dashboard-standard.html'));
        } catch (error) {
            console.error(error);
            res.status(500).send('Erreur du serveur');
        }
    });

    // Dashboard Pro
    router.get('/pro', async (req, res) => {
        if (req.session.user.abonnement !== 'pro') {
            // Vérifier le paiement pour pro
            const conn = await getDbConnection();
            const [paiements] = await conn.execute(
                'SELECT * FROM paiements WHERE utilisateur_id = ? AND statut = "payé"',
                [req.session.user.id]
            );
            conn.end();

            if (paiements.length === 0) {
                return res.redirect('/dashboard/standard');
            }
        }

        try {
            const conn = await getDbConnection();
            const [produits] = await conn.execute(
                'SELECT * FROM produits WHERE utilisateur_id = ? ORDER BY quantite ASC LIMIT 500',
                [req.session.user.id]
            );
            
            const [ventes] = await conn.execute(
                'SELECT p.nom, SUM(v.quantite) as total_ventes, SUM(v.quantite * v.prix_unitaire) as chiffre_affaire ' +
                'FROM ventes v JOIN produits p ON v.produit_id = p.id ' +
                'WHERE v.utilisateur_id = ? AND DATE(v.date_vente) = CURDATE() ' +
                'GROUP BY v.produit_id',
                [req.session.user.id]
            );
            
            conn.end();

            res.sendFile(path.join(__dirname, '../views/dashboard-pro.html'));
        } catch (error) {
            console.error(error);
            res.status(500).send('Erreur du serveur');
        }
    });

    // Dashboard Premium
    router.get('/premium', async (req, res) => {
        if (req.session.user.abonnement !== 'premium') {
            // Vérifier le paiement pour premium
            const conn = await getDbConnection();
            const [paiements] = await conn.execute(
                'SELECT * FROM paiements WHERE utilisateur_id = ? AND statut = "payé"',
                [req.session.user.id]
            );
            conn.end();

            if (paiements.length === 0) {
                return res.redirect('/dashboard/standard');
            }
        }

        try {
            const conn = await getDbConnection();
            const [produits] = await conn.execute(
                'SELECT * FROM produits WHERE utilisateur_id = ? ORDER BY quantite ASC LIMIT 2000',
                [req.session.user.id]
            );
            
            const [ventes] = await conn.execute(
                'SELECT p.nom, SUM(v.quantite) as total_ventes, SUM(v.quantite * v.prix_unitaire) as chiffre_affaire, ' +
                'SUM(v.quantite * (v.prix_unitaire - p.prix_achat)) as benefice ' +
                'FROM ventes v JOIN produits p ON v.produit_id = p.id ' +
                'WHERE v.utilisateur_id = ? AND DATE(v.date_vente) BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND CURDATE() ' +
                'GROUP BY v.produit_id ORDER BY total_ventes DESC LIMIT 10',
                [req.session.user.id]
            );
            
            conn.end();

            res.sendFile(path.join(__dirname, '../views/dashboard-premium.html'));
        } catch (error) {
            console.error(error);
            res.status(500).send('Erreur du serveur');
        }
    });

    // API pour basculer le mode sombre/clair
    router.post('/toggle-dark-mode', async (req, res) => {
        try {
            const conn = await getDbConnection();
            await conn.execute(
                'UPDATE utilisateurs SET mode_sombre = ? WHERE id = ?',
                [req.body.modeSombre, req.session.user.id]
            );
            conn.end();

            req.session.user.mode_sombre = req.body.modeSombre;
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false });
        }
    });

    return router;
};