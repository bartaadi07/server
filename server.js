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
        console.log(`Lekérés indítása: ${videoId}`);
        
        // 1. Lépés: Lekérjük a videó főoldalát, hogy megkapjuk a szükséges sütiket/fejléceket
        const response = await axios.get(`https://videa.hu/videainfo/${videoId}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://videa.hu/',
                'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 10000
        });

        const data = response.data;

        // Finomított keresés az MP4 linkekre
        const matches = data.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g);

        if (matches && matches.length > 0) {
            // A leghosszabb URL általában a legjobb minőség
            let directUrl = matches.sort((a, b) => b.length - a.length)[0];
            
            // HTML entitások tisztítása
            directUrl = directUrl.replace(/&amp;/g, '&').replace(/\\/g, '');

            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Siker! Videó kinyerve.`);
            
            return res.json({ url: directUrl });
        } else {
            console.log("A válasz nem tartalmazott mp4 linket. A Videa valószínűleg blokkolta a szervert.");
            return res.status(500).json({ error: 'A Videa blokkolja a szerver IP-címét.' });
        }
    } catch (error) {
        console.error('Lekérési hiba:', error.message);
        res.status(500).json({ error: 'Hálózati hiba a Videa elérésekor.' });
    }
});

app.get('/', (req, res) => res.send('API OK'));

app.listen(port, () => console.log(`🚀 Szerver elindult a ${port} porton.`));