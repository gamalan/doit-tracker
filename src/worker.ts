// Cloudflare Worker entry point that combines SvelteKit app with scheduled functions
import svelteKitWorker from "../.svelte-kit/cloudflare/_worker";
import { processDailyMissedHabits, processWeeklyMissedHabits } from '$lib/cron/dailyMissedHandler';

// Import the scheduled handler from hooks.server (we'll need to build first)

export default {
  // Use SvelteKit's fetch handler directly
  fetch: svelteKitWorker.fetch,

  // Add our scheduled function
  async scheduled(ctr, env, ctx) {
    console.log('Scheduled function called with cron:', ctr.cron);
    switch (ctr.cron) {
      case '59 23 * * *':
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Always process daily missed habits
        console.log('Starting daily missed habits processing via cron');
        const dailyResult = await processDailyMissedHabits();
        console.log('Daily missed habits cron job completed:', dailyResult);
        if (dayOfWeek === 1) {
          console.log('It\'s Monday - processing weekly missed habits via cron');
          const weeklyResult = await processWeeklyMissedHabits();
          console.log('Weekly missed habits cron job completed:', weeklyResult);
        } else {
          console.log(`Skipping weekly processing (runs on Mondays only). Today is ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
        }
        break;
    }
  }
};