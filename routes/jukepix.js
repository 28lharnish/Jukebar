const express = require('express');
const router = express.Router();
const { setJukepix, isJukepixEnabled, setLyricsEnabled, isLyricsEnabled, jukepix } = require('../utils/jukepix');

router.post('/toggleJukepix', (req, res) => {
    if(req.session.token?.id !== Number(process.env.OWNER_ID)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    if(!jukepix) {
        return res.status(400).json({ error: 'Jukepix URL is not configured' });
    }
    setJukepix(enabled);
    res.json({ enabled });
    console.log(`Jukepix is now ${enabled ? 'enabled' : 'disabled'}.`);
});

router.get('/jukepixStatus', (req, res) => {
    res.json({ enabled: isJukepixEnabled() });
});

router.post('/toggleLyrics', (req, res) => {
    if(req.session.token?.id !== Number(process.env.OWNER_ID)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    setLyricsEnabled(enabled);
    res.json({ enabled });
    console.log(`Lyrics are now ${enabled ? 'enabled' : 'disabled'}.`);
});

router.get('/lyricsStatus', (req, res) => {
    res.json({ enabled: isLyricsEnabled() });
});

module.exports = router;
