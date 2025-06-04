require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'votre_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Mettez à true si vous utilisez HTTPS
}));

// Configuration de la base de données
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'SENCOMPTA'
};

// Connexion à la base de données
async function getDbConnection() {
    return await mysql.createConnection(dbConfig);
}

// Redirection de la racine vers la page de connexion
app.get('/', (req, res) => {
    res.redirect('/connexion');
});

// Routes statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

// Importer les routes
const authRoutes = require('./routes/auth')(getDbConnection);
const dashboardRoutes = require('./routes/dashboard')(getDbConnection);
const apiRoutes = require('./routes/api')(getDbConnection);

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);

// Route de mise à niveau
app.get('/upgrade', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/connexion');
    }

    res.sendFile(path.join(__dirname, 'views/upgrade.html'));
});

// Route de traitement du paiement
app.post('/process-payment', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Non autorisé' });
    }

    try {
        const { methode, numero, montant, abonnement } = req.body;

        const conn = await getDbConnection();
        await conn.execute(
            'INSERT INTO paiements (utilisateur_id, montant, methode, numero_transaction, statut) VALUES (?, ?, ?, ?, ?)',
            [req.session.user.id, montant, methode, numero, 'payé']
        );

        await conn.execute(
            'UPDATE utilisateurs SET abonnement = ? WHERE id = ?',
            [abonnement, req.session.user.id]
        );

        conn.end();

        req.session.user.abonnement = abonnement;

        res.json({
            success: true,
            redirectUrl: `/dashboard/${abonnement}`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur du serveur' });
    }
});

// Routes pour les différentes pages
app.get('/produits', (req, res) => {
    if (!req.session.user) return res.redirect('/connexion');
    res.sendFile(path.join(__dirname, 'views/produits.html'));
});

app.get('/ventes', (req, res) => {
    if (!req.session.user) return res.redirect('/connexion');
    res.sendFile(path.join(__dirname, 'views/ventes.html'));
});

app.get('/alertes', (req, res) => {
    if (!req.session.user) return res.redirect('/connexion');
    res.sendFile(path.join(__dirname, 'views/alertes.html'));
});

app.get('/collaborateurs', (req, res) => {
    if (!req.session.user || req.session.user.abonnement === 'standard') {
        return res.redirect('/dashboard/standard');
    }
    res.sendFile(path.join(__dirname, 'views/collaborateurs.html'));
});

app.get('/dettes', (req, res) => {
    if (!req.session.user || req.session.user.abonnement !== 'premium') {
        return res.redirect('/dashboard/standard');
    }
    res.sendFile(path.join(__dirname, 'views/dettes.html'));
});

app.get('/parametres', (req, res) => {
    if (!req.session.user) return res.redirect('/connexion');
    res.sendFile(path.join(__dirname, 'views/parametres.html'));
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
