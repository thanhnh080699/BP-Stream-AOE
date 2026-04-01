import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const RECORD_DIR = process.env.RECORD_DIR || '/usr/local/srs/objs/nginx/html/record';
const LIVE_DIR = process.env.LIVE_DIR || '/usr/local/srs/objs/nginx/html/live';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

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
            res.type('application/vnd.apple.mpegurl');
            return res.send(content);
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
        const response = await fetch('http://192.168.9.214:1985/api/v1/streams');
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'SRS API not reachable' });
    }
});

// Helper to scan for recordings - Supporting both legacy MP4 chunks and new HLS formats
app.get('/api/recordings/:machineId', (req, res) => {
    const { machineId } = req.params;
    
    // Check possible root paths for this machine
    const possiblePaths = [
        path.join(RECORD_DIR, 'live', 'live', machineId),
        path.join(RECORD_DIR, 'live', machineId)
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
