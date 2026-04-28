import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { connectDatabase } from './src/config/database.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import employeeRoutes from './src/routes/employees.js';

dotenv.config({ path: 'server/.env' });

const app = express();
const port = process.env.PORT || 5050;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'editable-table-api' });
});

app.use('/api/employees', employeeRoutes);
app.use(errorHandler);

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start API server:', error.message);
    process.exit(1);
  });
