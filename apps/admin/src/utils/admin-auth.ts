import { decodeJwt } from "jose";

export const ADMIN_AUTH_TOKEN = "admin-auth-token";

export interface AdminTokenPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  is_owner?: boolean;
}

export function getAdminAuthToken() {
  return localStorage.getItem(ADMIN_AUTH_TOKEN);
}

export function setAdminAuthToken(token: string) {
  localStorage.setItem(ADMIN_AUTH_TOKEN, token);
}

export function clearAdminAuthToken() {
  localStorage.removeItem(ADMIN_AUTH_TOKEN);
}

export function getAdminTokenPayload(token: string) {
  return decodeJwt(token) as AdminTokenPayload;
}

export function isAdminTokenValid(token: string | null) {
  if (!token)
    return false;

  try {
    const payload = getAdminTokenPayload(token);
    if (payload.is_owner !== true)
      return false;
    if (!payload.exp)
      return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
