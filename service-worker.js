// --- 修改：版本號 (每次有重大修改，建議改這裡，例如 v2, v3) ---
const CACHE_NAME = 'learnwrite-cache-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png', // 建議加入圖示
  './icon-512.png'
];

// 1. 安裝事件：強制讓新版 Service Worker 進入 waiting 狀態
self.addEventListener('install', (event) => {
  // [關鍵] 跳過等待：讓新 Service Worker 立即接手，不用等舊的分頁關閉
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// 2. 啟用事件：清除舊版本的快取
self.addEventListener('activate', (event) => {
  // [關鍵] 立即接管所有頁面控制權
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keyList) => {
        return Promise.all(keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('刪除舊快取:', key);
            return caches.delete(key);
          }
        }));
      })
    ])
  );
});

// 3. 請求攔截：採用「Network First (網路優先)」策略
// 邏輯：先去網路抓 -> 抓成功 (存快取 + 回傳新版) -> 抓失敗 (回傳舊快取)
self.addEventListener('fetch', (event) => {
  // 對於非 GET 請求 (如 POST)，直接回傳網路請求，不處理快取
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 如果網路請求成功，複製一份存入快取 (更新快取)
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 如果網路請求失敗 (離線)，則讀取快取
        console.log('網路不可用，切換至離線快取:', event.request.url);
        return caches.match(event.request);
      })
  );
});