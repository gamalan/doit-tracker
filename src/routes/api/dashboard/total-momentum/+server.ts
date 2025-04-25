import { json } from '@sveltejs/kit';
import { getUserTotalMomentum } from '$lib/habits';

export const GET = async ({ locals }) => {
  const session = await locals.auth();
  
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const userId = session.user?.id;
  
  if (!userId) {
    return new Response('User ID not found', { status: 400 });
  }
  
  // Get user's total momentum score - this is typically a fast operation
  const totalMomentum = await getUserTotalMomentum(userId);
  
  return json({
    totalMomentum
  });
};