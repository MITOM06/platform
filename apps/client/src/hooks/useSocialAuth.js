import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useSocialAuth = () => {
  const { signInWithSocial } = useAuth();

  const loginWithGoogle = useCallback(() => signInWithSocial('google'), [signInWithSocial]);
  const loginWithFacebook = useCallback(() => signInWithSocial('facebook'), [signInWithSocial]);
  const loginWithX = useCallback(() => signInWithSocial('twitter'), [signInWithSocial]);

  return { loginWithGoogle, loginWithFacebook, loginWithX };
};