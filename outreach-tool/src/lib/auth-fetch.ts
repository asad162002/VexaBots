import { supabase } from './supabase';

// Small wrapper around fetch that automatically attaches the
// user's Supabase access token as a Bearer token.
// Every client-to-API request to our own API routes must be authenticated.
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

// Convenience: authenticated GET
export async function authGet(url: string): Promise<Response> {
  return authFetch(url, { method: 'GET' });
}

// Convenience: authenticated POST with JSON body
export async function authPost(
  url: string,
  body: unknown
): Promise<Response> {
  return authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
