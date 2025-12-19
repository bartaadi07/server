// server.js - Railway & GitHub Pages kompatibilis (Javított verzió)
const express = require('express');
const { exec } = require('child_process'); // exec-re váltottunk a jobb kompatibilitásért
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
// Railway-en a process.env.PORT kötelező, otthon 5500
const port = process.env.PORT || 5500;

// CORS engedélyezése minden honlap számára
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
    
    // Parancs összeállítása platform szerint
    // Windows-on a mappában lévő .exe-t használja, Linuxon (Railway) a telepített parancsot
    const cmd = os.platform() === 'win32' 
        ? `"${path.join(__dirname, 'yt-dlp.exe')}" -f best -g --no-warnings ${videoUrl}`
        : `yt-dlp -f best -g --no-warnings ${videoUrl}`;

    console.log(`Lekérés indítása a Videáról: ${videoId}`);

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error('Szerver hiba (yt-dlp):', stderr || error.message);
            return res.status(500).json({ error: 'Kinyerési hiba a szerveren' });
        }

        const url = stdout.trim();
        
        // Ellenőrizzük, hogy kaptunk-e valódi URL-t
        if (url && url.startsWith('http')) {
            cache[videoId] = { url, timestamp: Date.now() };
            console.log(`Sikeres kinyerés: ${videoId}`);
            res.json({ url });
        } else {
            console.error('Nem érkezett érvényes stream URL');
            res.status(404).json({ error: 'Nem található videó stream' });
        }
    });
});

// Alap útvonal, hogy lásd, fut-e a szerver
app.get('/', (req, res) => {
    res.send(`Szerver fut (Mód: ${os.platform()})`);
});

app.listen(port, () => {
    console.log(`🚀 Szerver aktív! Port: ${port} | Platform: ${os.platform()}`);
});