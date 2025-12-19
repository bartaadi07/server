const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
// Railway-en kötelező a process.env.PORT
const port = process.env.PORT || 5500;

// CORS engedélyezése a kliens oldalról érkező kérésekhez
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
    
    /** * Railway-re optimalizált kapcsolók:
     * -f 18: Kisebb felbontású mp4-et kér, ami sokkal kevesebb RAM-ot igényel kinyeréskor
     * --no-playlist: Megakadályozza a listák véletlen beolvasását
     */
    const args = [
        videoUrl, 
        '-f', '18', 
        '-g', 
        '--no-warnings', 
        '--quiet', 
        '--no-playlist',
        '--geo-bypass'
    ];

    // Időkorlát (20mp) és memória puffer limit beállítása
    execFile(ytDlpPath, args, { timeout: 20000, maxBuffer: 1024 * 512 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Hiba a kinyeréskor:', error.message);
            // 500-as hiba esetén a kliens visszavált iframe-re (vids.js:343)
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
    console.log(`🚀 Szerver aktív! Port: ${port} | Mód: ${os.platform()}`);
});