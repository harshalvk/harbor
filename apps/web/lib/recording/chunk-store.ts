const DB_NAME = 'harbor-recordings'
const DB_VERSION = 1
const STORE_NAME = 'chunks'

export interface StoredChunk {
  id: string
  sessionId: string
  index: number
  blob: Blob
  status: "pending" | "uploaded"
  createdAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })

        store.createIndex("sessionId_status", ["sessionId", "status"])
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

export async function addChunk(sessionId: string, index: number, blob: Blob): Promise<void> {
  const db = await openDB()
  const chunk: StoredChunk = {
    id: `${sessionId}:${index}`,
    sessionId,
    index,
    blob,
    status: "pending",
    createdAt: Date.now()
  }
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(chunk)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingChunks(sessionId: string): Promise<StoredChunk[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const index = tx.objectStore(STORE_NAME).index("sessionId_status")
    const range = IDBKeyRange.only([sessionId, "pending"])
    const request = index.getAll(range)
    
    request.onsuccess = () => resolve(request.result as StoredChunk[])
    request.onerror = () => reject(request.error)
  })
}

export async function markUploaded(chunkId: string): Promise<void> {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(chunkId)
    
    getRequest.onsuccess = () => {
      const chunk = getRequest.result as StoredChunk | undefined
      if (chunk) {
        chunk.status = "uploaded"
        store.put(chunk)
      }
    }
    
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}