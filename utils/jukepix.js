
require('dotenv').config({quiet: true});

const { Vibrant } = require('node-vibrant/node');
const spotifyApi = require('./spotify').spotifyApi;
const apikey = process.env.JUKEPIX_API_KEY;
const jukepix = process.env.JUKEPIX_URL;
const jukepixLength = process.env.JUKEPIX_LENGTH;

let jukepixEnabled = false;
let lyricsEnabled = false;

const reqOptions =
{
	method: 'POST',
	headers: {
		'API': apikey,
		'Content-Type': 'application/json'
	}
};

const defaultBarColor = '#00ff00';
const defaultBarEndColor = '#29ff29';

let albumBarColor = null;
let albumBarEndColor = null;

let lastTrack = null;
let trackLyrics = new Map();
let lastProgress = 0;
let lastDisplayedLyric = null;
let lastLyricDisplayTime = 0;

const barUpdateInterval = setInterval(async () => {
    if(!jukepixEnabled) return;
    fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${spotifyApi.getAccessToken()}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const image = data.item.album.images[0].url;

        Vibrant.from(image).getPalette()
        .then((palette) => {
            if(palette.Vibrant) {
                albumBarColor = palette.Vibrant.hex;
                albumBarEndColor = albumBarColor;
            }
        });

        if(data.progress_ms < lastProgress) {
            fetch(`${jukepix}/api/fill?color=${encodeURIComponent('#000000')}&length=${process.env.JUKEPIX_LENGTH}`, reqOptions)
                .then(response => response.json())
                .catch((error) => console.error('Clear Error:', error));
        }
        const progress = data.progress_ms / data.item.duration_ms;
        const fillLength = Math.floor(progress * jukepixLength);
        
        fetch(`${jukepix}/api/gradient?startColor=${encodeURIComponent(albumBarColor || defaultBarColor)}&endColor=${encodeURIComponent(albumBarEndColor || defaultBarEndColor)}&length=${fillLength}`, reqOptions)
            .then(response => response.json())
            .catch((error) => console.error('Bar Error:', error));

        lastProgress = data.progress_ms;
    });
}, 1000); 

const lyricInterval = setInterval(() => {
    if(lyricsEnabled && trackLyrics.size > 0) {
        const currentTime = lastProgress / 1000;
        const now = Date.now();
        
        // Find the lyric with the closest timestamp <= currentTime
        let closestTime = null;
        for (const time of trackLyrics.keys()) {
            if (time <= currentTime) {
                if (closestTime === null || time > closestTime) {
                    closestTime = time;
                }
            }
        }
        
        if (closestTime !== null) {
            const lyricLine = trackLyrics.get(closestTime);
            // Only update if lyric is different OR 5 seconds have passed
            if (lyricLine && (lyricLine !== lastDisplayedLyric || now - lastLyricDisplayTime >= 5000)) {
                lastDisplayedLyric = lyricLine;
                lastLyricDisplayTime = now;
                fetch(`${jukepix}/api/say?text=${encodeURIComponent(lyricLine)}&textColor=${encodeURIComponent("#ffffff")}&backgroundColor=${encodeURIComponent("#000000")}`, reqOptions)
                    .then(response => response.json())
                    .catch((error) => console.error('Lyric Error:', error));
            }
        }
    }
}, 200)

function displayTrack(track) {
    if (!jukepixEnabled || !track) return;
    
    lastTrack = track;

    const trackName = track.name || "No Track Playing";
    const albumName = track.album.name || "Unknown Album"
    const artistName = track.artist || "Unknown Artist";
    const displayText = `♪♫ ${trackName} - ${artistName} ♪♫        `;

    if(!lyricsEnabled) {
        fetch(`${jukepix}/api/say?text=${encodeURIComponent(displayText)}&textColor=${encodeURIComponent("#ffffff")}&backgroundColor=${encodeURIComponent("#000000")}`, reqOptions)
        .then(response => response.json())
        .catch((error) => console.error('Error:', error));

        return;
    }

    fetch(`https://lrclib.net/api/get?artist_name=${artistName}&track_name=${trackName}&album_name=${albumName}&duration=${track.duration_ms / 1000}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(res => 
        {
            if(res.statusCode == 404) { return };

            if(res.syncedLyrics) {
                trackLyrics = new Map();
                trackLyrics.set(0, ""); // Add starting point
                
                for (const line of res.syncedLyrics.split('\n')) {
                    const match = line.match(/\[(\d{2}:\d{2}\.\d{2})\](.*)/);
                    if (match) {
                        const time = parseFloat(changeLyricToSeconds(match[1]));
                        const text = match[2].trim();
                        if (text) trackLyrics.set(time, text);
                    }
                }
                lastDisplayedLyric = null;
            } else {
                fetch(`${jukepix}/api/say?text=${encodeURIComponent(displayText)}&textColor=${encodeURIComponent("#ffffff")}&backgroundColor=${encodeURIComponent("#000000")}`, reqOptions)
                    .then(response => response.json())
                    .catch((error) => console.error('Error:', error));

                    return;
            }
        }
    )
    .catch(err => console.error(err))
}

function setJukepix(enabled) {
    jukepixEnabled = enabled;

    if(jukepixEnabled) {
        console.log('Enabling Jukepix display.');
        fetch(`${jukepix}/api/fill?color=${encodeURIComponent('#000000')}&length=${process.env.JUKEPIX_LENGTH}`, reqOptions)
            .then(response => response.json())
            .catch((error) => console.error('Clear Error:', error));

        fetch(`${jukepix}/api/say?text=Jukepix%20Enabled&textColor=${encodeURIComponent('#00ff00')}&backgroundColor=${encodeURIComponent('#000000')}`, reqOptions)
            .then(response => response.json())
            .catch((error) => console.error('Clear Error:', error));
    } else {
        console.log('Disabling Jukepix display.');
        fetch(`${jukepix}/api/fill?color=${encodeURIComponent('#000000')}&length=${process.env.JUKEPIX_LENGTH}`, reqOptions)
            .then(response => response.json())
            .catch((error) => console.error('Clear Error:', error));

        fetch(`${jukepix}/api/say?text=Jukepix%20Disabled&textColor=${encodeURIComponent('#ff0000')}&backgroundColor=${encodeURIComponent('#000000')}`, reqOptions)
            .then(response => response.json())
            .catch((error) => console.error('Clear Error:', error));

        setTimeout(() => {
            fetch(`${jukepix}/api/say?text=${encodeURIComponent(' ')}&textColor=${encodeURIComponent('#ffffff')}&backgroundColor=${encodeURIComponent('#000000')}`, reqOptions)
                .then(response => response.json())
                .catch((error) => console.error('Clear Error:', error));
        }, 1500);
    }

    return jukepixEnabled;
}

function changeLyricToSeconds(syncedTime) {
    // Converts [01:00.42] to 60.42
    if(!syncedTime) return 'Unknown Time';
    if(syncedTime === '[00:00.00]') return 0;
    
    let syncedMins = parseInt(syncedTime.split(':')[0]);
    let syncedSecs = parseInt(syncedTime.split(':')[1].split('.')[0]);
    let syncedMScs = parseInt(syncedTime.split('.')[1]);
    syncedMins *= 60;
    syncedSecs += syncedMins;
    if(syncedMScs < 10) syncedMScs = `0${syncedMScs}`
    return `${syncedSecs}.${syncedMScs}`
}

function isJukepixEnabled() {
    return jukepixEnabled;
}

function setLyricsEnabled(enabled) {
    lyricsEnabled = enabled;
    return lyricsEnabled;
}

function isLyricsEnabled() {
    return lyricsEnabled;
}

module.exports = {
    displayTrack,
    setJukepix,
    isJukepixEnabled,
    setLyricsEnabled,
    isLyricsEnabled,
    jukepix
};