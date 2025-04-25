import { SvelteKitAuth } from "@auth/sveltekit"
import Google from "@auth/sveltekit/providers/google"
import { getOrCreateUser } from '$lib/db/user';

export const { handle, signIn, signOut } = SvelteKitAuth(async (event) => {
  const AUTH_SECRET = event.platform?.env?.AUTH_SECRET;
  const GOOGLE_CLIENT_ID = event.platform?.env?.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = event.platform?.env?.GOOGLE_CLIENT_SECRET;

  if (!AUTH_SECRET) {
    console.error('Missing AUTH_SECRET');
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Missing Google Client ID or Client Secret');
  }

  const authOptions = {
    providers: [
      Google({
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code"
          }
        }
      }),
    ],
    secret: AUTH_SECRET,
    trustHost: true,
    callbacks: {
      // Add user ID to the session
      async session({ session, token }) {
        if (session?.user) {
          // Get email to ensure consistent user lookup
          const email = session.user.email;
          if (!email) {
            console.error('Email missing from session, cannot identify user');
            return null;
          }

          try {
            // Find or create user - primarily by email to avoid duplicates
            const dbUser = await getOrCreateUser({
              id: token.sub as string,
              email: email,
              name: session.user.name as string | null,
              image: session.user.image as string | null
            });


            // Important: Set session ID to match the database ID
            if (dbUser && dbUser.id) {
              session.user.id = dbUser.id;
            } else {
              console.error('Failed to find/create user in database during session callback');
              return null;
            }
          } catch (error) {
            console.error('Error in session callback ensuring user exists:', error);
            // Don't return session if we couldn't verify/create the user
            return null;
          }
        }

        return session;
      },

      // Customize JWT contents and create/retrieve user in database
      async jwt({ token, account, profile, user }) {
        // If this is a sign-in
        if (profile && account) {
          // Store or update user in our database by email (to prevent duplicates)
          if (token.email) {
            try {
              const dbUser = await getOrCreateUser({
                id: token.sub as string,
                email: token.email,
                name: token.name as string | null,
                image: token.picture as string | null
              });

              // Verify the user was created/retrieved successfully
              if (!dbUser || !dbUser.id) {
                console.error('Failed to create/retrieve user in database');
                throw new Error('User creation/retrieval failed');
              }

              // Update token.sub to match the database user ID for consistency
              token.sub = dbUser.id;
            } catch (error) {
              console.error('Error creating/retrieving user:', error);
              // This will fail the sign-in process
              throw error;
            }
          }
        }
        return token;
      }
    },
    debug: true,
  }
  return authOptions
})