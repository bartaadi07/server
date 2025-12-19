const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5500;

app.use(cors());

const cache = {};
const CACHE_TIME = 30 * 60 * 1000; 

app.get('/api/videa-extractor', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Nincs ID' });

    if (cache[videoId] && Date.now() - cache[videoId].timestamp < CACHE_TIME) {
        return res.json({ url: cache[videoId].url });
    }

    try {
        // Lekérjük a lejátszó oldalt
        const response = await axios.get(`https://videa.hu/player?v=${videoId}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://videa.hu/'
            },
            timeout: 15000
        });

        const html = response.data;
        let directUrl = null;

        // 1. Módszer: Keresés a forrás listában (JSON formátum)
        const sourceMatch = html.match(/["']?source["']?\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
        if (sourceMatch) directUrl = sourceMatch[1];

        // 2. Módszer: Ha az első nem sikerült, keressük a '_v_s_sources' listát
        if (!directUrl) {
            const multiMatch = html.match(/src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/gi);
            if (multiMatch) {
                // Kivesszük az utolsót (általában ez a legjobb minőség)
                const lastSrc = multiMatch[multiMatch.length - 1];
                const cleanMatch = lastSrc.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i);
                if (cleanMatch) directUrl = cleanMatch[1];
            }
        }

        if (directUrl) {
            // Karakterkódolások tisztítása
            directUrl = directUrl.replace(/&amp;/g, '&').replace(/\\/g, '');
            
            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Siker! Link kinyerve: ${videoId}`);
            return res.json({ url: directUrl });
        } else {
            console.error("Nem sikerült kinyerni a forrást a HTML-ből.");
            return res.status(404).json({ error: 'A videó forrása jelenleg nem elérhető.' });
        }
    } catch (error) {
        console.error('Lekérési hiba:', error.message);
        res.status(500).json({ error: 'A hálózati kapcsolat megszakadt.' });
    }
});

app.get('/', (req, res) => res.send('API Aktív'));
app.listen(port, () => console.log(`Szerver kész: ${port}`));