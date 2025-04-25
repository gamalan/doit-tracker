import { drizzle } from 'drizzle-orm/d1';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

// Type for the Cloudflare D1 Database
interface Env {
  DB: D1Database;
}

let db: DrizzleD1Database<typeof schema>;
let isInitialized = false;

// This function initializes the database connection
export function initializeDatabase(env?: Env) {
  if (isInitialized) {
    console.log('Database already initialized');
    return getDb();
  }

  try {
    if (!env) {
      console.error('No environment provided for database initialization');
      throw new Error('Database environment not available');
    }
    
    console.log('Initializing Cloudflare D1 database');
    db = drizzle(env.DB, { schema });
    isInitialized = true;
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// This function gets the database instance
export function getDb() {
  if (!isInitialized) {
    throw new Error('Database not initialized. Make sure initializeDatabase is called first.');
  }

  if (!db) {
    throw new Error('Database not initialized');
  }

  return db;
}