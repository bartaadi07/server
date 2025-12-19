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
        // Közvetlenül a lejátszó oldalt kérjük le
        const response = await axios.get(`https://videa.hu/player?v=${videoId}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'https://videa.hu/'
            },
            timeout: 10000
        });

        const html = response.data;
        
        // Megkeressük a JavaScript változót, amiben a videó forrásai vannak
        // Ez a regex kiszedi a "_v_s_sources" vagy hasonló JSON listákat
        const sourceRegex = /source[:\s]+["'](https:\/\/[^"']+\.mp4[^"']*)["']/i;
        const match = html.match(sourceRegex);

        if (match && match[1]) {
            let directUrl = match[1].replace(/&amp;/g, '&');
            
            // Ha relatív URL lenne (ritka), kiegészítjük
            if (directUrl.startsWith('//')) directUrl = 'https:' + directUrl;

            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Sikeres kinyerés (HTML): ${videoId}`);
            return res.json({ url: directUrl });
        } else {
            // Második próbálkozás: b64 kódolt források keresése
            const b64Regex = /sources[:\s]+["']([^"']+)["']/i;
            const b64Match = html.match(b64Regex);
            
            console.error("Nem sikerült a kinyerés a HTML-ből.");
            return res.status(404).json({ error: 'A videó forrása rejtett vagy nem elérhető.' });
        }
    } catch (error) {
        console.error('Szerver hiba:', error.message);
        res.status(500).json({ error: 'A Videa elutasította a kapcsolatot.' });
    }
});

app.get('/', (req, res) => res.send('Backend üzemkész!'));

app.listen(port, () => console.log(`Szerver elindult: ${port}`));