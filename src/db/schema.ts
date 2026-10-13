import { relations } from 'drizzle-orm';
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const downloadHistory = pgTable('download_history', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').references(() => users.uid),
  url: text('url').notNull(),
  title: text('title').notNull(),
  thumbnail: text('thumbnail'),
  fileSize: text('file_size'),
  format: text('format'),
  quality: text('quality'),
  telegramPostUrl: text('telegram_post_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const telegramChannels = pgTable('telegram_channels', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull().unique(),
  channelTitle: text('channel_title'),
  enabled: text('enabled').default('true'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  downloads: many(downloadHistory),
}));

export const downloadHistoryRelations = relations(downloadHistory, ({ one }) => ({
  user: one(users, {
    fields: [downloadHistory.userUid],
    references: [users.uid],
  }),
}));
