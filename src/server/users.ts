import { db } from "@/db";
import { users } from "@/db/schema";

/** Records the member on first sight, keeping their email current. */
export async function ensureUser(user: { id: string; email: string }) {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
}
