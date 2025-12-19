// server.js - Stabilizált verzió a Railway erőforrás-korlátaihoz
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
// Railway-en a process.env.PORT kötelező, lokálisan 5500
const port = process.env.PORT || 5500;

// CORS engedélyezése minden honlap számára (szükséges a GitHub Pages-hez)
app.use(cors());

const cache = {};
const CACHE_TIME = 30 * 60 * 1000; // 30 perc cache a terhelés csökkentésére

app.get('/api/videa-extractor', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Nincs ID megadva' });

    // 1. Lépés: Cache ellenőrzése (hogy ne kelljen minden kérésnél futtatni a yt-dlp-t)
    const cached = cache[videoId];
    if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
        console.log(`Cache találat: ${videoId}`);
        return res.json({ url: cached.url });
    }

    const videoUrl = `https://videa.hu/player?v=${videoId}`;
    
    /**
     * OPTIMALIZÁLT PARANCS:
     * -f 18: Standard MP4 (360p/480p), ami gyors és kevés RAM-ot igényel.
     * --no-playlist: Megakadályozza a listák elemzését.
     * --geo-bypass: Segít az esetleges földrajzi korlátozásokon.
     * --no-warnings: Tisztább kimenet, kevesebb memória a buffernek.
     */
    const cmd = os.platform() === 'win32' 
        ? `"${path.join(__dirname, 'yt-dlp.exe')}" -f 18 -g --no-warnings --no-playlist ${videoUrl}`
        : `yt-dlp -f 18 -g --no-warnings --no-playlist --geo-bypass ${videoUrl}`;

    console.log(`Lekérés indítása: ${videoId}`);

    /**
     * exec BEÁLLÍTÁSOK:
     * timeout: 20000 (20 másodperc) - Ennyi időt adunk a folyamatnak.
     * maxBuffer: 1024 * 512 (512 KB) - Korlátozzuk a kimeneti memória-puffert.
     */
    exec(cmd, { timeout: 20000, maxBuffer: 1024 * 512 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Szerver hiba (yt-dlp):', stderr || error.message);
            
            // Ha a parancs nem található
            if (error.code === 'ENOENT') {
                return res.status(500).json({ error: 'Rendszerhiba: yt-dlp hiányzik.' });
            }
            
            // Minden egyéb hiba (timeout, memóriahiány)
            return res.status(500).json({ error: 'A kinyerés sikertelen vagy időtúllépés történt.' });
        }

        const url = stdout.trim();
        
        // Ellenőrizzük, hogy érvényes HTTP címet kaptunk-e
        if (url && url.startsWith('http')) {
            cache[videoId] = { url, timestamp: Date.now() };
            console.log(`Sikeres kinyerés: ${videoId}`);
            
            // Biztosítjuk, hogy a válasz fejlécében ott legyen a CORS
            res.header("Access-Control-Allow-Origin", "*");
            res.json({ url });
        } else {
            console.error('Nem érkezett érvényes stream URL kimenet');
            res.status(404).json({ error: 'A videó forrása nem elérhető.' });
        }
    });
});

// Alap ellenőrző útvonal
app.get('/', (req, res) => {
    res.send(`A szerver aktívan fut! (Mód: ${os.platform()})`);
});

app.listen(port, () => {
    console.log(`🚀 Szerver aktív! Port: ${port}`);
});