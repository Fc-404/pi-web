/**
 * IndexedDB 缓存封装 — 会话消息增量缓存
 *
 * DB: pi-web | Store: sessionCache
 * Key: sessionFile (string)
 * Value: { messages, lastSeq, totalLines }
 */

import type { HistoryMessage } from './api'

const DB_NAME = 'pi-web'
const STORE_NAME = 'sessionCache'
const DB_VERSION = 1

export interface SessionCache {
  messages: HistoryMessage[]
  lastSeq: number
  totalLines: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** 读取会话缓存 */
export async function getSessionCache(sessionFile: string): Promise<SessionCache | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(sessionFile)

    request.onsuccess = () => {
      resolve(request.result || undefined)
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/** 写入/更新会话缓存 */
export async function setSessionCache(sessionFile: string, cache: SessionCache): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(cache, sessionFile)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

/** 删除会话缓存 */
export async function deleteSessionCache(sessionFile: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(sessionFile)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}
