import { json } from '@sveltejs/kit';
import { getMomentumHistory } from '$lib/habits';

export const GET = async ({ locals }) => {
  const session = await locals.auth();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    return new Response('User ID not found', { status: 400 });
  }
  
  // Get momentum history for the past 30 days - this is often the slowest operation
  const momentumHistory = await getMomentumHistory(userId, 30);
  
  return json({
    momentumHistory
  });
};