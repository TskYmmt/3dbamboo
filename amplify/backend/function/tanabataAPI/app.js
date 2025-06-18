const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');

const app = express();
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.STORAGE_BUCKET;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// S3を使用してデータを保存/読み込み
async function loadTanzaku() {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: 'tanzaku_data.json'
        };
        const data = await s3.getObject(params).promise();
        return JSON.parse(data.Body.toString());
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            return [];
        }
        throw error;
    }
}

async function saveTanzaku(tanzakuList) {
    const params = {
        Bucket: BUCKET_NAME,
        Key: 'tanzaku_data.json',
        Body: JSON.stringify(tanzakuList, null, 2),
        ContentType: 'application/json'
    };
    await s3.putObject(params).promise();
}

// Routes
app.get('/api/tanzaku', async (req, res) => {
    try {
        const tanzakuList = await loadTanzaku();
        res.json({ success: true, tanzaku: tanzakuList });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load tanzaku' });
    }
});

app.post('/api/tanzaku', async (req, res) => {
    try {
        const { position, rotation, textData, timestamp } = req.body;
        
        if (!position || !rotation || !textData) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const tanzakuList = await loadTanzaku();
        const newTanzaku = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            position,
            rotation,
            textData,
            timestamp: timestamp || new Date().toISOString(),
            author: req.body.author || 'Anonymous'
        };

        if (req.body.isImageTanzaku) {
            newTanzaku.isImageTanzaku = req.body.isImageTanzaku;
            newTanzaku.imageIndex = req.body.imageIndex;
            newTanzaku.imagePath = req.body.imagePath;
        }
        
        tanzakuList.push(newTanzaku);
        await saveTanzaku(tanzakuList);
        
        res.json({ success: true, tanzaku: newTanzaku });
    } catch (error) {
        console.error('Error adding tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.put('/api/tanzaku/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { position, rotation } = req.body;
        
        if (!position || !rotation) {
            return res.status(400).json({ success: false, error: 'Missing position or rotation' });
        }
        
        const tanzakuList = await loadTanzaku();
        const tanzakuIndex = tanzakuList.findIndex(t => t.id === id);
        
        if (tanzakuIndex === -1) {
            return res.status(404).json({ success: false, error: 'Tanzaku not found' });
        }
        
        tanzakuList[tanzakuIndex].position = position;
        tanzakuList[tanzakuIndex].rotation = rotation;
        tanzakuList[tanzakuIndex].lastModified = new Date().toISOString();
        
        if (req.body.isImageTanzaku) {
            tanzakuList[tanzakuIndex].isImageTanzaku = req.body.isImageTanzaku;
            tanzakuList[tanzakuIndex].imageIndex = req.body.imageIndex;
            tanzakuList[tanzakuIndex].imagePath = req.body.imagePath;
        }
        
        await saveTanzaku(tanzakuList);
        res.json({ success: true, tanzaku: tanzakuList[tanzakuIndex] });
    } catch (error) {
        console.error('Error updating tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = app;