import { Router, Request, Response } from 'express';
import { supabase } from '../config/database';

const router = Router();

// Test endpoint to create a test user and return a JWT token
// ONLY FOR DEVELOPMENT - DO NOT USE IN PRODUCTION
router.post('/create-test-user', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const email = 'test@tradeitm.com';
    const password = 'test123456';

    // Try to sign in first
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError && signInData.session) {
      return res.json({
        success: true,
        message: 'Test user already exists, signed in successfully',
        access_token: signInData.session.access_token,
        user: signInData.user,
      });
    }

    // If sign in failed, create the user
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError) {
      throw signUpError;
    }

    // Now sign in to get the token
    const { data: newSignInData, error: newSignInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (newSignInError || !newSignInData.session) {
      throw newSignInError || new Error('Failed to sign in after creating user');
    }

    res.json({
      success: true,
      message: 'Test user created and signed in successfully',
      access_token: newSignInData.session.access_token,
      user: newSignInData.user,
    });
  } catch (error) {
    console.error('Error creating test user:', error);
    res.status(500).json({
      error: 'Failed to create test user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
