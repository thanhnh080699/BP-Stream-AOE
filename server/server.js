import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const RECORD_DIR = process.env.RECORD_DIR || '/usr/local/srs/objs/nginx/html/record';
const LIVE_DIR = process.env.LIVE_DIR || '/usr/local/srs/objs/nginx/html/live';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));
// Helper to rewrite m3u8 content with absolute segment paths
const rewriteM3u8 = (content, basePath) => {
    return content.split('\n').map(line => {
        if (line && !line.startsWith('#')) {
            if (line.startsWith('/record')) return line;
            return path.join(basePath, line);
        }
        return line;
    }).join('\n');
};

// Serve a trimmed live m3u8 (last N segments only) so hls.js plays near real-time
app.get('/api/live-m3u8/:app/:stream', (req, res) => {
    const { app: appName, stream } = req.params;
    const today = new Date().toISOString().split('T')[0];
    // Path structure on disk: RECORD_DIR/live/live/machine/date/index.m3u8
    const m3u8RelPath = path.join('live', appName, stream, today, 'index.m3u8');
    const m3u8Path = path.join(RECORD_DIR, m3u8RelPath);

    if (!fs.existsSync(m3u8Path)) {
        return res.status(404).send('Stream not found');
    }

    const content = fs.readFileSync(m3u8Path, 'utf8');
    const lines = content.split('\n');

    // Extract header lines and segment pairs (EXTINF + .ts)
    const headerLines = [];
    const segments = [];
    let i = 0;

    while (i < lines.length && !lines[i].startsWith('#EXTINF')) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#EXT-X-ENDLIST') && !line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
            headerLines.push(line);
        }
        i++;
    }

    let currentGroup = [];
    while (i < lines.length) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-ENDLIST')) { i++; continue; }
        if (line.startsWith('#EXTINF')) {
            currentGroup = [line];
        } else if (line && !line.startsWith('#') && currentGroup.length > 0) {
            currentGroup.push(line);
            segments.push(currentGroup);
            currentGroup = [];
        } else if (line.startsWith('#EXT-X-DISCONTINUITY')) {
            currentGroup = [line];
        } else if (line && currentGroup.length > 0) {
            currentGroup.push(line);
        }
        i++;
    }

    const LIVE_SEGMENTS = 6;
    const recentSegments = segments.slice(-LIVE_SEGMENTS);
    const mediaSequence = Math.max(0, segments.length - LIVE_SEGMENTS);

    const basePath = `/record/live/${appName}/${stream}/${today}`;
    const output = [
        ...headerLines,
        `#EXT-X-MEDIA-SEQUENCE:${mediaSequence}`,
        ...recentSegments.flat().map(line => (line && !line.startsWith('#')) ? path.join(basePath, line) : line),
        ''
    ].join('\n');

    res.type('application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send(output);
});

// Intercept M3U8 for playback to ensure it acts like a VOD (allows scrubbing, shows duration)
app.use('/record', (req, res, next) => {
    if (req.path.endsWith('.m3u8') && req.query.vod === 'true') {
        const fullPath = path.join(RECORD_DIR, req.path);
        if (fs.existsSync(fullPath)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (!content.includes('#EXT-X-PLAYLIST-TYPE')) {
                content = content.replace('#EXTM3U', '#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD');
            }
            if (!content.includes('#EXT-X-ENDLIST')) {
                content += '\n#EXT-X-ENDLIST\n';
            }

            // Rewrite segment paths to be absolute
            const basePath = path.join('/record', path.dirname(req.path));
            const rewrittenContent = rewriteM3u8(content, basePath);

            res.type('application/vnd.apple.mpegurl');
            return res.send(rewrittenContent);
        }
    }
    next();
});

app.use('/record', express.static(RECORD_DIR));
app.use('/live', express.static(LIVE_DIR));

const NAMES_FILE = path.join(RECORD_DIR, 'machine_names.json');

// Get custom machine names
app.get('/api/machine-names', (req, res) => {
    if (!fs.existsSync(NAMES_FILE)) {
        return res.json({});
    }
    try {
        const data = fs.readFileSync(NAMES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Failed to read names' });
    }
});

// Save custom machine names
app.post('/api/machine-names', (req, res) => {
    try {
        const names = req.body;
        fs.writeFileSync(NAMES_FILE, JSON.stringify(names, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save names' });
    }
});

// Proxy for SRS Status to avoid mixed content
app.get('/api/srs-streams', async (req, res) => {
    try {
        const response = await fetch('http://srs_aoe:1985/api/v1/streams');
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('SRS Proxy Error:', err.message);
        res.status(500).json({ error: 'SRS API not reachable' });
    }
});

// Helper to scan for recordings - Supporting both legacy MP4 chunks and new HLS formats
app.get('/api/recordings/:machineId', (req, res) => {
    const { machineId } = req.params;
    
    // Check possible root paths for this machine
    const possiblePaths = [
        path.join(RECORD_DIR, 'live', 'live', machineId),
        path.join(RECORD_DIR, 'live', machineId),
        path.join(RECORD_DIR, machineId)
    ];

    let rootPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            rootPath = p;
            break;
        }
    }

    if (!rootPath) return res.json([]);

    try {
        const entries = fs.readdirSync(rootPath);
        const recordingsMap = {};

        entries.forEach(entry => {
            const entryPath = path.join(rootPath, entry);
            const stats = fs.statSync(entryPath);

            // New HLS recording logic: look inside YYYY-MM-DD folder for index.m3u8
            if (stats.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry)) {
                const date = entry;
                const m3u8Path = path.join(entryPath, 'index.m3u8');
                
                if (fs.existsSync(m3u8Path)) {
                    const relPath = path.relative(RECORD_DIR, m3u8Path);
                    recordingsMap[date] = {
                        id: date,
                        date: date,
                        title: `Video toàn ngày ${date} (HLS)`,
                        url: `/record/${relPath}?vod=true`,
                        playlist: [] 
                    };
                } else {
                    // Fallback to legacy MP4 scanning
                    const files = fs.readdirSync(entryPath)
                        .filter(f => f.endsWith('.mp4'))
                        .sort()
                        .map(f => {
                            const relPath = path.relative(RECORD_DIR, path.join(entryPath, f));
                            return `/record/${relPath}`;
                        });

                    if (files.length > 0) {
                        recordingsMap[date] = {
                            id: date,
                            date: date,
                            title: `Video toàn ngày ${date}`,
                            url: files[0],
                            playlist: files
                        };
                    }
                }
            }
        });

        const sortedResult = Object.values(recordingsMap).sort((a,b) => b.date.localeCompare(a.date));
        res.json(sortedResult);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to scan recordings' });
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});
