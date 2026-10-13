import { db } from './index.ts';
import { users, downloadHistory } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string, photoUrl?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
        photoUrl: photoUrl || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
          photoUrl: photoUrl || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database user upsert failed:", error);
    throw new Error("Failed to register/sync user with database.", { cause: error });
  }
}

export async function saveDownloadToHistory(data: {
  userUid?: string;
  url: string;
  title: string;
  thumbnail?: string;
  fileSize?: string;
  format?: string;
  quality?: string;
  telegramPostUrl?: string;
}) {
  try {
    const res = await db.insert(downloadHistory)
      .values({
        userUid: data.userUid || null,
        url: data.url,
        title: data.title,
        thumbnail: data.thumbnail || null,
        fileSize: data.fileSize || null,
        format: data.format || null,
        quality: data.quality || null,
        telegramPostUrl: data.telegramPostUrl || null,
      })
      .returning();
    return res[0];
  } catch (error) {
    console.error("Failed to save download history in database:", error);
    return null;
  }
}

export async function getUserDownloadHistory(userUid: string) {
  try {
    return await db.select()
      .from(downloadHistory)
      .where(eq(downloadHistory.userUid, userUid))
      .orderBy(desc(downloadHistory.createdAt));
  } catch (error) {
    console.error("Failed to fetch download history:", error);
    return [];
  }
}
