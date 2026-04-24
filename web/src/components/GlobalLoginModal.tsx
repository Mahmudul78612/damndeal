'use client';

import LoginModal from '@/components/LoginModal';
import { useAuth } from '@/context/AuthContext';

export default function GlobalLoginModal() {
  const { showLoginModal, closeLoginModal, loginRedirect } = useAuth();
  return <LoginModal isOpen={showLoginModal} onClose={closeLoginModal} redirect={loginRedirect} />;
}
