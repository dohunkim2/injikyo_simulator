import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD;
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
}

function sign(value: string) {
  const secret = getSessionSecret();

  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET이 설정되지 않았습니다.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAdminAuthConfigured() {
  return Boolean(getAdminPassword() && getSessionSecret());
}

export function verifyAdminPassword(password: string) {
  const configuredPassword = getAdminPassword();

  if (!configuredPassword) {
    return false;
  }

  return safeEqual(password, configuredPassword);
}

export function createAdminSessionToken() {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifyAdminSessionToken(token?: string) {
  if (!token || !isAdminAuthConfigured()) {
    return false;
  }

  const [issuedAt, signature] = token.split(".");
  const issuedAtMs = Number(issuedAt);

  if (!issuedAt || !signature || !Number.isFinite(issuedAtMs)) {
    return false;
  }

  if (Date.now() - issuedAtMs > ADMIN_SESSION_TTL_MS) {
    return false;
  }

  return safeEqual(signature, sign(issuedAt));
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export function getAdminCookieName() {
  return ADMIN_COOKIE_NAME;
}

export function getAdminSessionMaxAge() {
  return Math.floor(ADMIN_SESSION_TTL_MS / 1000);
}
