const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config(); // ✅ Load .env

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));


// Connect MongoDB
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Routes
app.use('/api/logs', require('./routes/callLogs'));
app.use('/api/admins', require('./routes/admins'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/connect', require('./routes/EmployeeConnect'));
app.use('/api/employees', require('./routes/employees'));


app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
