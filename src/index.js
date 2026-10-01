export default {
    async fetch(request) {
        const reqBody = await request.text();
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://anilist.co',
                'Referer': 'https://anilist.co/',
            },
            body: reqBody,
        });
        const body = await res.text();
        return new Response(body, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });
    },
};
