const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

module.exports = function(getDbConnection) {
    const router = express.Router();

    // Page de connexion
    router.get('/connexion', (req, res) => {
        res.sendFile(path.join(__dirname, '../views/connexion.html'));
    });

    // Page d'inscription
    router.get('/inscription', (req, res) => {
        res.sendFile(path.join(__dirname, '../views/inscription.html'));
    });

    // Traitement de la connexion
    router.post('/connexion', async (req, res) => {
        try {
            const { email, mot_de_passe } = req.body;
            const conn = await getDbConnection();
            const [rows] = await conn.execute('SELECT * FROM utilisateurs WHERE email = ?', [email]);
            conn.end();

            if (rows.length === 0) {
                return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
            }

            const utilisateur = rows[0];
            const motDePasseValide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);

            if (!motDePasseValide) {
                return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
            }

            // Créer un token JWT
            const token = jwt.sign(
                { id: utilisateur.id, email: utilisateur.email, abonnement: utilisateur.abonnement },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Stocker en session
            req.session.user = {
                id: utilisateur.id,
                nom: utilisateur.nom,
                prenom: utilisateur.prenom,
                email: utilisateur.email,
                abonnement: utilisateur.abonnement,
                mode_sombre: utilisateur.mode_sombre
            };

            // Rediriger vers le dashboard approprié
            let redirectUrl = '/dashboard/standard';
            if (utilisateur.abonnement === 'pro') redirectUrl = '/dashboard/pro';
            if (utilisateur.abonnement === 'premium') redirectUrl = '/dashboard/premium';

            res.json({ success: true, redirectUrl });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Erreur du serveur' });
        }
    });

    // Traitement de l'inscription
    router.post('/inscription', async (req, res) => {
        try {
            const { nom, prenom, email, mot_de_passe, telephone } = req.body;
            const conn = await getDbConnection();

            // Vérifier si l'email existe déjà
            const [existingUsers] = await conn.execute('SELECT id FROM utilisateurs WHERE email = ?', [email]);
            if (existingUsers.length > 0) {
                conn.end();
                return res.status(400).json({ message: 'Cet email est déjà utilisé' });
            }

            // Hasher le mot de passe
            const salt = await bcrypt.genSalt(10);
            const motDePasseHash = await bcrypt.hash(mot_de_passe, salt);

            // Créer l'utilisateur (standard par défaut)
            await conn.execute(
                'INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone) VALUES (?, ?, ?, ?, ?)',
                [nom, prenom, email, motDePasseHash, telephone]
            );

            conn.end();
            res.json({ success: true, message: 'Inscription réussie. Vous pouvez maintenant vous connecter.' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Erreur du serveur' });
        }
    });

    // Déconnexion
    router.get('/deconnexion', (req, res) => {
        req.session.destroy();
        res.redirect('/connexion');
    });

    return router;
};
