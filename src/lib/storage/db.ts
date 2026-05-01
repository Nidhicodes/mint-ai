import { openDB, type IDBPDatabase } from 'idb';
import type { App, AppVersion } from '../types';

const DB_NAME = 'mint-ai';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('apps')) {
          const store = db.createObjectStore('apps', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', { keyPath: ['appId', 'version'] });
          store.createIndex('appId', 'appId');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveApp(app: App): Promise<void> {
  const db = await getDb();
  await db.put('apps', app);
}

export async function getApp(id: string): Promise<App | null> {
  const db = await getDb();
  return (await db.get('apps', id)) ?? null;
}

export async function listApps(): Promise<App[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('apps', 'updatedAt');
  return all.reverse(); // newest first
}

export async function deleteApp(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('apps', id);
  // Clean up history
  const tx = db.transaction('history', 'readwrite');
  const idx = tx.store.index('appId');
  let cursor = await idx.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
}

export async function saveVersion(appId: string, version: AppVersion): Promise<void> {
  const db = await getDb();
  await db.put('history', { ...version, appId });
}

export async function getHistory(appId: string): Promise<AppVersion[]> {
  const db = await getDb();
  const idx = db.transaction('history').store.index('appId');
  return await idx.getAll(appId);
}

export async function rollbackToVersion(
  appId: string,
  targetVersion: AppVersion,
): Promise<App> {
  const app = await getApp(appId);
  if (!app) {
    throw new Error(`App not found: ${appId}`);
  }

  const newVersionNumber = app.version + 1;

  const newVersion: AppVersion = {
    version: newVersionNumber,
    html: targetVersion.html,
    prompt: `Rollback to version ${targetVersion.version}`,
    timestamp: Date.now(),
  };

  const updatedApp: App = {
    ...app,
    html: targetVersion.html,
    version: newVersionNumber,
    updatedAt: Date.now(),
  };

  await saveApp(updatedApp);
  await saveVersion(appId, newVersion);

  return updatedApp;
}
