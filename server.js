const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5500;

app.use(cors());

// Cache objektum a terhelés csökkentésére
const cache = {};
const CACHE_TIME = 30 * 60 * 1000; 

app.get('/api/videa-extractor', async (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).json({ error: 'Nincs ID' });

    if (cache[videoId] && Date.now() - cache[videoId].timestamp < CACHE_TIME) {
        return res.json({ url: cache[videoId].url });
    }

    try {
        // Trükk: Olyan fejlécet küldünk, mintha egy sima böngésző lenne
        const response = await axios.get(`https://videa.hu/videainfo/${videoId}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://videa.hu/'
            }
        });

        // Kinyerjük az összes .mp4 linket a válaszból
        const data = response.data;
        const matches = data.match(/https:\/\/[^?| ]+\.mp4[^ |?|&]*/g);

        if (matches && matches.length > 0) {
            // Megkeressük a legmagasabb minőséget (általában a lista vége felé van)
            let directUrl = matches[matches.length - 1];
            
            // Tisztítjuk az URL-t a biztonság kedvéért
            directUrl = directUrl.split('?')[0]; 

            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Siker! Videó kinyerve: ${videoId}`);
            
            res.json({ url: directUrl });
        } else {
            console.error("Válasz érkezett, de nincs benne mp4 link.");
            res.status(404).json({ error: 'Nem található videó fájl.' });
        }
    } catch (error) {
        console.error('Lekérési hiba:', error.message);
        res.status(500).json({ error: 'A Videa nem válaszolt a kérésre.' });
    }
});

app.get('/', (req, res) => res.send('API üzemkész!'));

app.listen(port, () => console.log(`Szerver elindult a ${port} porton.`));