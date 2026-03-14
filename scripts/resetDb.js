import { dbConnect } from '../lib/db.js';
import mongoose from 'mongoose';
import 'dotenv/config';

const resetDb = async () => {
  try {
    await dbConnect();
    console.log('Connected to database. Dropping all collections...');
    
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].drop();
      console.log(`Dropped collection: ${key}`);
    }
    
    console.log('✅ Database reset complete.');
    await mongoose.disconnect();
  } catch (error) {
    if (error.code === 26) {
      console.log('Namespace not found - collection probably already dropped');
    } else {
      console.error('Error resetting database:', error);
    }
    await mongoose.disconnect();
    process.exit(1);
  }
};

resetDb();
