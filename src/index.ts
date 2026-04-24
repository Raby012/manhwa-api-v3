import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { createClient } from 'redis';

// Load Environment Variables (Secret Passwords)
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Global Database Variables
export let db: any = null;
export let cache: any = null;

async function startServer() {
  try {
    console.log('Booting up ManhwaHub V3 Engine...');

    // 1. Connect to Redis (If configured)
    if (process.env.REDIS_URL) {
      cache = createClient({ url: process.env.REDIS_URL });
      cache.on('error', (err: any) => console.error('Redis Error:', err));
      await cache.connect();
      console.log('✅ Redis Cache Connected');
    } else {
      console.log('⚠️ No REDIS_URL found. Running without external cache.');
    }

    // 2. Connect to MongoDB (If configured)
    if (process.env.MONGO_URI) {
      const mongoClient = new MongoClient(process.env.MONGO_URI);
      await mongoClient.connect();
      db = mongoClient.db('manhwahub');
      console.log('✅ MongoDB Database Connected');
    } else {
      console.log('⚠️ No MONGO_URI found. Running without database.');
    }

    // 3. Base Route
    app.get('/', (req, res) => {
      res.json({ status: 'ok', message: 'ManhwaHub V3 Enterprise API Running' });
    });

    // Note: We will import and mount all the /api routes in the next step!

    // 4. Start Listening
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ FATAL ERROR: Failed to start server:', error);
    process.exit(1);
  }
}

// Ignite the Engine
startServer();
