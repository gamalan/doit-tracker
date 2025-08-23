import { json } from '@sveltejs/kit';
import { processDailyMissedHabits, processWeeklyMissedHabits } from '$lib/cron/dailyMissedHandler';

/**
 * Cron endpoint for processing daily missed habits
 * This endpoint is called by Cloudflare Workers cron trigger
 */
export const POST = async ({ request }: { request: Request }) => {
  try {
    // Verify the request is from Cloudflare Workers cron
    const userAgent = request.headers.get('user-agent') || '';
    const cfCron = request.headers.get('cf-cron') || '';
    
    // Basic security check - only allow requests with Cloudflare cron headers
    if (!cfCron && !userAgent.includes('Cloudflare')) {
      console.warn('Unauthorized cron request attempt');
      return new Response('Unauthorized', { status: 401 });
    }
    
    console.log('Starting missed habits cron job');
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Process all missed daily habits
    const dailyResult = await processDailyMissedHabits();
    console.log('Daily missed habits cron job completed:', dailyResult);
    
    let weeklyResult = { processed: 0, errors: 0 };
    
    // Process weekly habits on Mondays
    if (dayOfWeek === 1) {
      console.log('Processing weekly missed habits (Monday)');
      weeklyResult = await processWeeklyMissedHabits();
      console.log('Weekly missed habits cron job completed:', weeklyResult);
    }
    
    return json({
      success: true,
      daily: {
        processed: dailyResult.processed,
        errors: dailyResult.errors
      },
      weekly: {
        processed: weeklyResult.processed,
        errors: weeklyResult.errors,
        skipped: dayOfWeek !== 1
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in daily missed habits cron job:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};

/**
 * GET endpoint for manual testing/debugging
 * Should not be used in production except for debugging
 */
export const GET = async () => {
  try {
    console.log('Manual trigger of missed habits processing');
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    const dailyResult = await processDailyMissedHabits();
    let weeklyResult = { processed: 0, errors: 0 };
    
    // Always run weekly processing in manual mode for testing
    console.log('Manual trigger: processing weekly missed habits');
    weeklyResult = await processWeeklyMissedHabits();
    
    return json({
      success: true,
      daily: {
        processed: dailyResult.processed,
        errors: dailyResult.errors
      },
      weekly: {
        processed: weeklyResult.processed,
        errors: weeklyResult.errors,
        forced: true // Indicates this was forced regardless of day
      },
      timestamp: new Date().toISOString(),
      note: 'This was a manual trigger'
    });
    
  } catch (error) {
    console.error('Error in manual missed habits processing:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};