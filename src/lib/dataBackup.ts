import { FluxLoadSettings, DEFAULT_SETTINGS } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

export interface FluxLoadBackupData {
  appName: string;
  version: string;
  exportedAt: string;
  totalItems: number;
  settings: FluxLoadSettings;
  history: any[];
  telegramConfig?: {
    chatId?: string;
    channelTitle?: string;
    botUsername?: string;
    botTokenMasked?: string;
    autoSend?: boolean;
  };
}

/**
 * Saves all state data directly to browser local storage.
 */
export function saveAllDataLocally(
  settings: FluxLoadSettings,
  history: any[],
  telegramConfig?: any
): { success: boolean; timestamp: string } {
  const timestamp = new Date().toISOString();
  try {
    if (settings) {
      localStorage.setItem('fluxload_settings', JSON.stringify(settings));
    }
    if (Array.isArray(history)) {
      localStorage.setItem('fluxload_download_history', JSON.stringify(history));
    }
    if (telegramConfig) {
      localStorage.setItem('fluxload_telegram_config', JSON.stringify(telegramConfig));
    }
    localStorage.setItem('fluxload_last_saved_at', timestamp);
    return { success: true, timestamp };
  } catch (e) {
    console.warn('Error saving all data locally:', e);
    return { success: false, timestamp };
  }
}

/**
 * Exports all user data (Settings, History, Favorites, Telegram Config) into a downloadable JSON file.
 */
export function exportAllDataAsJson(
  settings: FluxLoadSettings,
  history: any[],
  telegramConfig?: any
) {
  // First ensure local storage is up to date
  saveAllDataLocally(settings, history, telegramConfig);

  const backup: FluxLoadBackupData = {
    appName: 'FluxLoad',
    version: '3.0',
    exportedAt: new Date().toISOString(),
    totalItems: history.length,
    settings,
    history,
    telegramConfig: telegramConfig
      ? {
          chatId: telegramConfig.chatId,
          channelTitle: telegramConfig.channelTitle,
          botUsername: telegramConfig.botUsername,
          botTokenMasked: telegramConfig.botTokenMasked,
          autoSend: Boolean(telegramConfig.autoSend),
        }
      : undefined,
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `fluxload-all-data-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Validates and parses a backup JSON string.
 */
export function parseAndValidateBackup(jsonString: string): {
  success: boolean;
  settings?: FluxLoadSettings;
  history?: any[];
  telegramConfig?: any;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid JSON structure' };
    }

    let settings: FluxLoadSettings = DEFAULT_SETTINGS;
    if (parsed.settings && typeof parsed.settings === 'object') {
      settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    }

    let history: any[] = [];
    if (Array.isArray(parsed.history)) {
      history = parsed.history.filter((item: any) => item && typeof item === 'object' && item.title && item.url);
    }

    return {
      success: true,
      settings,
      history,
      telegramConfig: parsed.telegramConfig,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Corrupted or unreadable JSON file',
    };
  }
}

/**
 * Syncs all settings and local history items into Firestore.
 */
export async function syncAllDataToCloud(
  userId: string,
  settings: FluxLoadSettings,
  history: any[],
  telegramConfig?: any
): Promise<{ success: boolean; syncedItemsCount: number; error?: string }> {
  if (!userId) {
    return { success: false, syncedItemsCount: 0, error: 'User is not authenticated' };
  }

  try {
    // 1. Sync User Settings and Telegram preferences to Firestore
    const settingsRef = doc(db, 'users', userId, 'profile', 'settings');
    const updatePayload: any = {
      userId,
      updatedAt: new Date().toISOString(),
      defaultType: settings.defaultType || 'video',
      defaultQuality: settings.defaultQuality || '720p',
      defaultFormat: settings.defaultFormat || 'mp4',
      autoSaveToDownloads: Boolean(settings.autoSaveToDownloads),
      saveFolderPrefix: settings.saveFolderPrefix || '',
      playNotificationSound: Boolean(settings.playNotificationSound),
      browserNotifications: Boolean(settings.browserNotifications),
      autoClearOnFinish: Boolean(settings.autoClearOnFinish),
      speedGraphEnabled: Boolean(settings.speedGraphEnabled),
      batchConcurrency: Number(settings.batchConcurrency || 1),
      maxFileSizeGb: Number(settings.maxFileSizeGb || 2),
      bdixFirstSpeed: Boolean(settings.bdixFirstSpeed),
      defaultRateLimit: settings.defaultRateLimit || 'unlimited',
    };

    if (telegramConfig) {
      updatePayload.telegram = {
        chatId: telegramConfig.chatId || '',
        channelTitle: telegramConfig.channelTitle || '',
        botUsername: telegramConfig.botUsername || '',
        configured: Boolean(telegramConfig.configured),
        updatedAt: new Date().toISOString(),
      };
    }

    await setDoc(settingsRef, updatePayload, { merge: true });

    // 2. Fetch existing document URLs to avoid duplicates
    const colRef = collection(db, 'users', userId, 'downloads');
    const existingSnap = await getDocs(colRef);
    const existingUrls = new Set<string>();
    existingSnap.forEach((d) => {
      const data = d.data();
      if (data.url) existingUrls.add(data.url);
    });

    // 3. Batch write local history items that aren't yet in Firestore
    let syncedCount = 0;
    const itemsToUpload = history.filter((h) => !existingUrls.has(h.url)).slice(0, 50);

    for (const item of itemsToUpload) {
      const docRef = doc(colRef);
      const cleanRecord = {
        id: docRef.id,
        userId,
        title: (item.title || 'Downloaded Media').slice(0, 500),
        url: (item.url || '').slice(0, 2048),
        type: (item.type || 'video').slice(0, 32),
        quality: (item.quality || 'auto').slice(0, 32),
        format: (item.format || 'mp4').slice(0, 32),
        createdAt: item.createdAt || new Date().toISOString(),
        isFavorite: Boolean(item.isFavorite),
        taskId: item.taskId ? String(item.taskId).slice(0, 128) : undefined,
        downloadUrl: item.downloadUrl ? String(item.downloadUrl).slice(0, 2048) : undefined,
      };

      await setDoc(docRef, cleanRecord);
      syncedCount++;
    }

    return {
      success: true,
      syncedItemsCount: syncedCount,
    };
  } catch (err: any) {
    console.error('Failed to sync all data to cloud:', err);
    return {
      success: false,
      syncedItemsCount: 0,
      error: err.message || 'Cloud sync failed',
    };
  }
}

/**
 * Loads cloud settings from Firestore for the given user.
 */
export async function loadCloudSettings(userId: string): Promise<FluxLoadSettings | null> {
  if (!userId) return null;
  try {
    const settingsRef = doc(db, 'users', userId, 'profile', 'settings');
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...DEFAULT_SETTINGS,
        ...data,
      } as FluxLoadSettings;
    }
  } catch (err) {
    console.warn('Could not load cloud settings:', err);
  }
  return null;
}
