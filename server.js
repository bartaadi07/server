const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
// Railway-en a PORT környezeti változó kötelező
const port = process.env.PORT || 5500;

app.use(cors());

// A yt-dlp elérési útja
// Linuxon (Railway) csak 'yt-dlp', Windows-on a helyi .exe
const ytDlpPath = os.platform() === 'win32' 
    ? path.join(__dirname, 'yt-dlp.exe') 
    : 'yt-dlp';

const cache = {};
const CACHE_TIME = 30 * 60 * 1000;

app.get('/api/videa-extractor', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Nincs ID' });

    const cached = cache[videoId];
    if (cached && Date.now() - cached.timestamp < CACHE_TIME) {
        return res.json({ url: cached.url });
    }

    const videoUrl = `https://videa.hu/player?v=${videoId}`;
    
    // EREDETI ARGUMENTUMOK + extra stabilitás Railway-re
    const args = [
        videoUrl, 
        '-f', 'best', 
        '-g', 
        '--no-warnings', 
        '--quiet',
        '--no-playlist'
    ];

    // Railway-en a memória szűkös, adjunk neki egy kis időt
    execFile(ytDlpPath, args, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Hiba:', error.message);
            // Ha nem találja a fájlt (ENOENT), az rendszerhiba
            return res.status(500).json({ error: 'Kinyerési hiba a szerveren' });
        }

        const url = stdout.trim();
        if (url && url.startsWith('http')) {
            cache[videoId] = { url, timestamp: Date.now() };
            res.json({ url });
        } else {
            console.error('Nincs URL a kimenetben');
            res.status(404).json({ error: 'Nincs stream' });
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 Szerver aktív! Port: ${port} | Mód: ${os.platform()}`);
});