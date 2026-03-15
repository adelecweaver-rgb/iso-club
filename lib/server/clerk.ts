import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

export function isClerkConfigured(): boolean {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  return Boolean(publishableKey && secretKey);
}

export async function safeAuth(): Promise<{ userId: string | null }> {
  if (!isClerkConfigured()) {
    return { userId: null };
  }
  try {
    const result = await auth();
    return { userId: result.userId ?? null };
  } catch {
    return { userId: null };
  }
}

export async function safeCurrentUser() {
  if (!isClerkConfigured()) {
    return null;
  }
  try {
    return await currentUser();
  } catch {
    return null;
  }
}
