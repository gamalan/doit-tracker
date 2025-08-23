import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { initializeDatabase } from '$lib/db/client';
import { handle as authHandle } from './lib/auth';
import { processDailyMissedHabits, processWeeklyMissedHabits } from '$lib/cron/dailyMissedHandler';

// Database initialization handler
const dbInit: Handle = async ({ event, resolve }) => {
  // Initialize the database with platform env (required for both production and local development with wrangler)
  if (!event.platform?.env) {
    console.error('Platform environment not available. Make sure you are running with wrangler.');
    throw new Error('Database environment not available. Are you using wrangler?');
  }
  
  initializeDatabase(event.platform.env);
  
  return resolve(event);
};

// Protect routes that require authentication
const authorization: Handle = async ({ event, resolve }) => {
  // Exclude public routes from protection
  const publicRoutes = ['/login', '/'];
  const isPublicRoute = publicRoutes.some(route => event.url.pathname.startsWith(route));
  
  // Get the user session
  const session = await event.locals.auth();
  
  // If not authenticated and not on a public route, redirect to login
  if (!session && !isPublicRoute) {
    throw redirect(303, '/login');
  }
  
  return resolve(event);
};

// Logger to help with debugging auth issues
const logger: Handle = async ({ event, resolve }) => {
  console.log(`Route requested: ${event.url.pathname}`);
  return resolve(event);
};

// Main sequence of handlers
export const handle = sequence(
  logger,
  dbInit,
  authHandle,
  authorization
);

// Cloudflare Workers scheduled event handler
export async function scheduled(event: any, env: any, ctx: any) {
  console.log('Scheduled event triggered:', event.cron);
  
  try {
    // Initialize database with environment
    initializeDatabase(env);
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Always process daily missed habits
    console.log('Starting daily missed habits processing via cron');
    const dailyResult = await processDailyMissedHabits();
    console.log('Daily missed habits cron job completed:', dailyResult);
    
    // Process weekly missed habits on Mondays (day 1)
    if (dayOfWeek === 1) {
      console.log('It\'s Monday - processing weekly missed habits via cron');
      const weeklyResult = await processWeeklyMissedHabits();
      console.log('Weekly missed habits cron job completed:', weeklyResult);
    } else {
      console.log(`Skipping weekly processing (runs on Mondays only). Today is ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
    }
    
    console.log('All cron jobs completed successfully');
    
  } catch (error) {
    console.error('Error in scheduled event handler:', error);
    throw error;
  }
}
