// server.js -Railway & GitHub Pages kompatibilis
const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const cors = require('cors'); // CORS modul beimportálása

const app = express();
const port = process.env.PORT || 5500;

// CORS beállítása: Engedélyezzük a GitHub Pages-ről érkező kéréseket
app.use(cors()); 

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
    // Railway-en (Linux) a yt-dlp néha más formátum-szűrést igényel, a '-f best' a legbiztosabb
    const args = [videoUrl, '-f', 'best', '-g', '--no-warnings', '--quiet'];

    execFile(ytDlpPath, args, (error, stdout, stderr) => {
        if (error) {
            console.error('Hiba:', error.message);
            return res.status(500).json({ error: 'Kinyerési hiba' });
        }

        const url = stdout.trim();
        if (url && url.startsWith('http')) {
            cache[videoId] = { url, timestamp: Date.now() };
            res.json({ url });
        } else {
            res.status(404).json({ error: 'Nincs stream' });
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 Szerver aktív! Port: ${port} | Mód: ${os.platform()}`);
});