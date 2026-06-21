const express = require('express');

require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const siteRoutes = require("./src/routes/siteRoutes");
const projetRoutes = require('./src/routes/projetRoutes');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API DGS SEO Platform - en construction');
});

app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/projets', projetRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});