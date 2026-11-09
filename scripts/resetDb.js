import { dbConnect } from '../lib/db.js';
import mongoose from 'mongoose';
import 'dotenv/config';

const resetDb = async () => {
  try {
    await dbConnect();
    console.log('Connected to database. Dropping all collections...');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const { name } of collections) {
      if (name.startsWith('system.')) continue;
      await mongoose.connection.db.dropCollection(name);
      console.log(`Dropped collection: ${name}`);
    }

    console.log('✅ Database reset complete.');
    await mongoose.disconnect();
    process.exit(0);
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
