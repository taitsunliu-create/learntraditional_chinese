const CACHE_NAME = 'hanzi-app-v1';

// 這裡列出「安裝時」必須立刻下載的核心檔案
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    // 外部核心程式庫 (必須快取，否則離線無法運作)
    'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];

// 1. 安裝 Service Worker 並快取核心檔案
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching core assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // 強制立即啟用新版 SW
});

// 2. 啟用並清除舊快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

// 3. 攔截請求 (Fetch) - 核心邏輯
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 策略 A: 針對 "hanzi-writer-data" (筆順資料) 進行動態快取
    // 這樣孩子練過的字，下次離線時也能寫
    if (url.href.includes('hanzi-writer-data') || url.href.includes('jsdelivr')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse; // 有快取就用快取

                // 沒快取就上網抓，抓完存起來
                try {
                    const fetchResponse = await fetch(event.request);
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                } catch (e) {
                    // 離線且沒快取時，無能為力 (筆順無法顯示)
                    return new Response('Offline', { status: 503 });
                }
            })
        );
        return;
    }

    // 策略 B: 針對 API (Gemini / TTS) -> 只能連網，不快取
    if (url.href.includes('googleapis.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 策略 C: 預設策略 (先找快取，找不到再連網)
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                // 如果完全離線且找不到檔案
                console.log('Offline and resource not found:', event.request.url);
            });
        })
    );
});