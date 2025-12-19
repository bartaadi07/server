// server.js - Railway & GitHub Pages kompatibilis (Optimalizált verzió)
const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5500;

// CORS engedélyezése: alapvető a GitHub Pages eléréshez
app.use(cors());

const cache = {};
const CACHE_TIME = 30 * 60 * 1000; // 30 perc cache

app.get('/api/videa-extractor', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Nincs ID megadva' });

    // Cache ellenőrzése
    const cached = cache[videoId];
    if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
        console.log(`Cache találat: ${videoId}`);
        return res.json({ url: cached.url });
    }

    const videoUrl = `https://videa.hu/player?v=${videoId}`;
    
    // Optimalizált parancs: 
    // --no-playlist: biztosan csak a videót keresi
    // --no-warnings: kevesebb logolás
    // -f 18: ez a legkisebb standard mp4 formátum (gyorsabb kinyerés, kevesebb RAM)
    const cmd = os.platform() === 'win32' 
        ? `"${path.join(__dirname, 'yt-dlp.exe')}" -f 18 -g --no-warnings --no-playlist ${videoUrl}`
        : `yt-dlp -f 18 -g --no-warnings --no-playlist ${videoUrl}`;

    console.log(`Lekérés indítása: ${videoId}`);

    // Időkorlát (timeout) beállítása: ha 15 mp alatt nem válaszol, leállítjuk
    exec(cmd, { timeout: 15000, maxBuffer: 1024 * 500 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Szerver hiba (yt-dlp):', stderr || error.message);
            
            if (error.code === 'ENOENT') {
                return res.status(500).json({ error: 'A kinyerő szoftver hiányzik a szerverről.' });
            }
            return res.status(500).json({ error: 'Időtúllépés vagy memória hiba a szerveren.' });
        }

        const url = stdout.trim();
        
        if (url && url.startsWith('http')) {
            cache[videoId] = { url, timestamp: Date.now() };
            console.log(`Sikeres kinyerés: ${videoId}`);
            res.json({ url });
        } else {
            console.error('Nem érkezett érvényes stream URL');
            res.status(404).json({ error: 'A videó nem található vagy nem kinyerhető.' });
        }
    });
});

// Alap útvonal ellenőrzéshez
app.get('/', (req, res) => {
    res.send(`A szerver aktívan fut! (Platform: ${os.platform()})`);
});

app.listen(port, () => {
    console.log(`🚀 Szerver aktív! Port: ${port}`);
});