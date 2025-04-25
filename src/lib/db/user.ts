import { getDb } from './client';
import { users } from './schema';
import { eq } from 'drizzle-orm';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export async function getUserById(id: string): Promise<User | undefined> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createUser(userData: NewUser): Promise<User> {
  const db = getDb();
  
  try {
    // First check if user already exists by email to avoid duplicates
    const existingUser = await getUserByEmail(userData.email);
    if (existingUser) {
      return existingUser;
    }

    // Then check if user already exists by ID
    const existingUserById = await getUserById(userData.id);
    if (existingUserById) {
      return existingUserById;
    }

    // Create the user
    await db.insert(users).values(userData);
    
    // Verify the user was actually created
    const createdUser = await getUserById(userData.id);
    if (!createdUser) {
      throw new Error(`Failed to create user with ID ${userData.id}`);
    }
    
    return createdUser;
  } catch (error) {
    console.error('Error in createUser:', error);
    throw error;
  }
}

export async function getOrCreateUser(userData: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<User> {
  try {
    // Ensure we have an ID
    if (!userData.id) {
      throw new Error('User ID is required');
    }
    
    // Ensure we have an email
    if (!userData.email) {
      throw new Error('User email is required');
    }
    
    // First check by email (primary method to avoid duplicates)
    const existingUserByEmail = await getUserByEmail(userData.email);
    
    if (existingUserByEmail) {
      return existingUserByEmail;
    }
    
    // Then check by ID as fallback
    const existingUserById = await getUserById(userData.id);
    
    if (existingUserById) {
      return existingUserById;
    }
    
    // Create user with proper error handling
    const newUser = await createUser({
      id: userData.id,
      email: userData.email,
      name: userData.name || null,
      image: userData.image || null
    });
    
    // Verify the user was created
    if (!newUser || !newUser.id) {
      throw new Error('User creation failed');
    }
    
    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  }
}