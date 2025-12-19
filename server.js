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
        console.log(`Lekérés: ${videoId}`);
        
        // Olyan fejlécek, amikkel a szerver egy valódi Chrome böngészőnek tűnik
        const axiosConfig = {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://videa.hu/'
            },
            timeout: 10000
        };

        // 1. PRÓBÁLKOZÁS: A videainfo oldal (gyorsabb)
        let response = await axios.get(`https://videa.hu/videainfo/${videoId}`, axiosConfig);
        let data = response.data;
        let matches = data.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g);

        // 2. PRÓBÁLKOZÁS: Ha az első nem sikerült, lekérjük a teljes lejátszó oldalt
        if (!matches || matches.length === 0) {
            console.log("1. módszer sikertelen, váltás a 2. módszerre...");
            response = await axios.get(`https://videa.hu/player?v=${videoId}`, axiosConfig);
            data = response.data;
            matches = data.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g);
        }

        if (matches && matches.length > 0) {
            // A leghosszabb URL tartalmazza a legtöbb biztonsági kulcsot
            let directUrl = matches.sort((a, b) => b.length - a.length)[0];
            
            // Karakterek tisztítása
            directUrl = directUrl.replace(/&amp;/g, '&').replace(/\\/g, '');

            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Sikeres kinyerés: ${videoId}`);
            
            return res.json({ url: directUrl });
        } else {
            throw new Error("Nem található videó link a válaszban.");
        }
    } catch (error) {
        console.error('Hiba részletei:', error.message);
        res.status(500).json({ error: 'A Videa jelenleg korlátozza a hozzáférést a szerverről.' });
    }
});

app.get('/', (req, res) => res.send('API OK'));

app.listen(port, () => console.log(`🚀 Szerver fut a ${port} porton!`));