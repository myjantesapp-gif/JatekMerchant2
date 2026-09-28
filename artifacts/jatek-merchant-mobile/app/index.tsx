import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function IndexRoute() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' ? '/(tabs)/overview' : '/login'} />;
}