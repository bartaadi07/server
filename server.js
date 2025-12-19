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
        console.log(`Lekérés folyamatban: ${videoId}`);
        
        // Közvetlenül a videainfo API-t hívjuk meg, amit a lejátszó is használ
        // Olyan fejlécekkel, amikkel "hús-vér" látogatónak tűnik a szerver
        const response = await axios.get(`https://videa.hu/videainfo/${videoId}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'https://videa.hu/'
            },
            timeout: 10000 // 10 másodperces időkorlát
        });

        const data = response.data;
        
        // Megkeressük az összes .mp4 linket a válaszban
        const matches = data.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g);

        if (matches && matches.length > 0) {
            // A leghosszabb URL tartalmazza általában a legjobb minőséget és a szükséges kulcsokat
            let directUrl = matches.sort((a, b) => b.length - a.length)[0];
            
            // Tisztítás: entitások és esetleges extra karakterek eltávolítása
            directUrl = directUrl.replace(/&amp;/g, '&').replace(/\\/g, '');

            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Sikeres kinyerés: ${videoId}`);
            
            // Manuálisan is beállítjuk a CORS fejlécet a biztonság kedvéért
            res.header("Access-Control-Allow-Origin", "*");
            return res.json({ url: directUrl });
        } else {
            console.error("Válasz érkezett, de nincs benne mp4 link.");
            return res.status(404).json({ error: 'A videó forrása nem található.' });
        }
    } catch (error) {
        console.error('Szerver hiba:', error.message);
        res.status(500).json({ error: 'Kinyerési hiba a szerveren (Videa blokkolás vagy hálózati hiba).' });
    }
});

app.get('/', (req, res) => res.send('API OK'));

app.listen(port, () => console.log(`🚀 Szerver aktív a ${port} porton!`));