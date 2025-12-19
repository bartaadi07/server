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
        console.log(`Próbálkozás a kinyeréssel: ${videoId}`);
        
        // 1. Kérés: Info oldal lekérése böngészőnek álcázva
        const response = await axios.get(`https://videa.hu/videainfo/${videoId}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            },
            timeout: 10000
        });

        const data = response.data;
        
        // Finomított keresés: MP4 linkek keresése többféle formátumban
        // Megnézzük a sima linkeket és a kódolt linkeket is
        const matches = data.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g);

        if (matches && matches.length > 0) {
            // Megkeressük a leghosszabb URL-t (általában ez tartalmazza a legtöbb paramétert/legjobb minőséget)
            let directUrl = matches.sort((a, b) => b.length - a.length)[0];
            
            // HTML entitások tisztítása (pl. &amp; -> &)
            directUrl = directUrl.replace(/&amp;/g, '&').replace(/\\/g, '');
            
            // Ha a link végén idézőjel vagy egyéb maradt, levágjuk
            directUrl = directUrl.split('"')[0].split("'")[0];

            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Siker! Link kinyerve.`);
            
            return res.json({ url: directUrl });
        } else {
            console.error("Nem található MP4 minta a válaszban.");
            return res.status(404).json({ error: 'A videó forrása nem azonosítható.' });
        }
    } catch (error) {
        console.error('Szerver hiba:', error.message);
        res.status(500).json({ error: 'A szerver nem tudta elérni a videó tárolót.' });
    }
});

app.get('/', (req, res) => res.send('API Aktív'));

app.listen(port, () => console.log(`Szerver elindítva a ${port} porton.`));