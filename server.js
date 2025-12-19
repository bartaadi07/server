const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Ehhez add ki: npm install axios

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
        // Közvetlenül lekérjük a Videa info fájlját, amit a lejátszó is használ
        const response = await axios.get(`https://videa.hu/videainfo/${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // Kikeressük a videó fájlok linkjeit a válaszból
        // A Videa válasza egy speciális formátum, amiből regex-szel szedjük ki az URL-t
        const matches = response.data.match(/https:\/\/[^ ]+\.mp4[^ ]*/g);

        if (matches && matches.length > 0) {
            // Az utolsó match általában a legjobb minőség (pl. 720p)
            const directUrl = matches[matches.length - 1].replace(/&amp;/g, '&');
            
            cache[videoId] = { url: directUrl, timestamp: Date.now() };
            console.log(`Sikeres kinyerés API-val: ${videoId}`);
            res.json({ url: directUrl });
        } else {
            throw new Error('Nem található MP4 link a válaszban');
        }
    } catch (error) {
        console.error('Kinyerési hiba:', error.message);
        res.status(500).json({ error: 'A Videa API nem válaszolt megfelelően.' });
    }
});

app.get('/', (req, res) => res.send('API OK'));

app.listen(port, () => console.log(`Szerver fut a ${port} porton`));