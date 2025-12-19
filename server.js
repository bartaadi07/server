const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5500;

app.use(cors());

const cache = {};
const CACHE_TIME = 30 * 60 * 1000;

app.get('/api/videa-extractor', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Nincs ID' });

    if (cache[videoId] && Date.now() - cache[videoId].timestamp < CACHE_TIME) {
        return res.json({ url: cache[videoId].url });
    }

    const videoUrl = `https://videa.hu/player?v=${videoId}`;
    
    // Railway-en (Linux) a 'yt-dlp' parancsot használjuk, Windows-on a helyi fájlt
    const ytCmd = os.platform() === 'win32' 
        ? `"${path.join(__dirname, 'yt-dlp.exe')}"` 
        : 'yt-dlp';

    // Kibővített parancs a stabilitásért
    const cmd = `${ytCmd} -f best -g --no-warnings --no-check-certificates --no-playlist "${videoUrl}"`;

    console.log(`Lekérés indítása: ${videoId}`);

    exec(cmd, { timeout: 25000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Szerver hiba:', stderr || error.message);
            return res.status(500).json({ error: 'Kinyerési hiba a szerveren' });
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
    console.log(`🚀 Szerver aktív! Port: ${port}`);
});