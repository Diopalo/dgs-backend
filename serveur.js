const express = require('express');

require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API DGS SEO Platform - en construction');
});

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});