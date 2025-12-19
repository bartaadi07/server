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

// ... (eleje változatlan)

app.get('/api/videa-extractor', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Nincs ID' });

    const videoUrl = `https://videa.hu/player?v=${videoId}`;
    
    // Először megpróbáljuk a globális yt-dlp-t, ha az nincs, 
    // megpróbáljuk explicit módon hívni
    const cmd = os.platform() === 'win32' 
        ? `"${path.join(__dirname, 'yt-dlp.exe')}" -f best -g ${videoUrl}`
        : `yt-dlp -f best -g ${videoUrl}`;

    console.log(`Futtatás: ${cmd}`);

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error('DEBUG - Error hiba:', error);
            console.error('DEBUG - Stderr:', stderr);
            
            // Ha nem találja (ENOENT), küldjünk vissza érthető hibaüzenetet
            if (error.code === 'ENOENT' || error.message.includes('not found')) {
                return res.status(500).json({ 
                    error: 'A yt-dlp nincs telepítve a szerveren. Ellenőrizd a nixpacks beállításokat!' 
                });
            }
            return res.status(500).json({ error: 'Kinyerési hiba a szerveren' });
        }

        const url = stdout.trim();
        if (url && url.startsWith('http')) {
            res.json({ url });
        } else {
            res.status(404).json({ error: 'Nem érkezett stream URL' });
        }
    });
});