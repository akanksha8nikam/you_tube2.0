const https = require('https');
https.get('https://you-tube2-0-two.vercel.app/watch/69dd0a39fb47f95d55499215', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const matches = data.match(/<video[^>]*src=[\"']([^\"']+)[\"']/g);
        console.log(matches || 'No video tags found');
    });
});
