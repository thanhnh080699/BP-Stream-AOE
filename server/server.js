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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

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
// Helper to scan directory for recordings
// Pattern: /record/live/[machine-id]/[date]/[time].mp4
app.get('/api/recordings/:machineId', (req, res) => {
    const { machineId } = req.params;
    const machinePath = path.join(RECORD_DIR, 'live', machineId);

    if (!fs.existsSync(machinePath)) {
        return res.json([]);
    }

    try {
        const dates = fs.readdirSync(machinePath).filter(d => fs.statSync(path.join(machinePath, d)).isDirectory());
        const recordings = dates.map(date => {
            const datePath = path.join(machinePath, date);
            const files = fs.readdirSync(datePath)
                .filter(f => f.endsWith('.mp4'))
                .map(f => ({
                    id: `${date}-${f}`,
                    title: `Video recording ${f}`,
                    time: f.replace('.mp4', ''),
                    duration: '5:00', // DVR segment duration
                    url: `http://192.168.9.214:8080/record/live/${machineId}/${date}/${f}`
                }));
            
            return {
                date,
                items: files.sort((a,b) => b.time.localeCompare(a.time))
            };
        });

        res.json(recordings.sort((a,b) => b.date.localeCompare(a.date)));
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
