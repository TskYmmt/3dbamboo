const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 8005;
const TANZAKU_FILE = path.join(__dirname, 'tanzaku_data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Large limit for canvas data
app.use(express.static(__dirname)); // Serve static files

// Health check endpoint for AWS
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize data file if it doesn't exist
async function initDataFile() {
    try {
        await fs.access(TANZAKU_FILE);
    } catch (error) {
        // File doesn't exist, create it
        await fs.writeFile(TANZAKU_FILE, JSON.stringify([], null, 2));
        console.log('Created tanzaku_data.json');
    }
}

// Load tanzaku data
async function loadTanzaku() {
    try {
        const data = await fs.readFile(TANZAKU_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading tanzaku:', error);
        return [];
    }
}

// Save tanzaku data
async function saveTanzaku(tanzakuList) {
    try {
        await fs.writeFile(TANZAKU_FILE, JSON.stringify(tanzakuList, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving tanzaku:', error);
        return false;
    }
}

// Routes

// Get all tanzaku
app.get('/api/tanzaku', async (req, res) => {
    try {
        const tanzakuList = await loadTanzaku();
        res.json({ success: true, tanzaku: tanzakuList });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load tanzaku' });
    }
});

// Add new tanzaku
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

        // Add image tanzaku specific fields if present
        if (req.body.isImageTanzaku) {
            newTanzaku.isImageTanzaku = req.body.isImageTanzaku;
            newTanzaku.imageIndex = req.body.imageIndex;
            newTanzaku.imagePath = req.body.imagePath;
        }
        
        tanzakuList.push(newTanzaku);
        
        const saved = await saveTanzaku(tanzakuList);
        if (saved) {
            res.json({ success: true, tanzaku: newTanzaku });
        } else {
            res.status(500).json({ success: false, error: 'Failed to save tanzaku' });
        }
    } catch (error) {
        console.error('Error adding tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update tanzaku position
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
        
        // Update image tanzaku specific fields if present
        if (req.body.isImageTanzaku) {
            tanzakuList[tanzakuIndex].isImageTanzaku = req.body.isImageTanzaku;
            tanzakuList[tanzakuIndex].imageIndex = req.body.imageIndex;
            tanzakuList[tanzakuIndex].imagePath = req.body.imagePath;
        }
        
        const saved = await saveTanzaku(tanzakuList);
        if (saved) {
            res.json({ success: true, tanzaku: tanzakuList[tanzakuIndex] });
        } else {
            res.status(500).json({ success: false, error: 'Failed to update tanzaku' });
        }
    } catch (error) {
        console.error('Error updating tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Clear all tanzaku (for developer mode) - Must be before /:id route
app.delete('/api/tanzaku/clear', async (req, res) => {
    try {
        console.log('Clearing all tanzaku...');
        const saved = await saveTanzaku([]);
        if (saved) {
            console.log('All tanzaku cleared successfully');
            res.json({ success: true, message: 'All tanzaku cleared' });
        } else {
            console.error('Failed to save empty tanzaku array');
            res.status(500).json({ success: false, error: 'Failed to clear tanzaku' });
        }
    } catch (error) {
        console.error('Error clearing tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Delete tanzaku (optional)
app.delete('/api/tanzaku/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const tanzakuList = await loadTanzaku();
        const filteredList = tanzakuList.filter(t => t.id !== id);
        
        if (filteredList.length === tanzakuList.length) {
            return res.status(404).json({ success: false, error: 'Tanzaku not found' });
        }
        
        const saved = await saveTanzaku(filteredList);
        if (saved) {
            res.json({ success: true, message: 'Tanzaku deleted' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to delete tanzaku' });
        }
    } catch (error) {
        console.error('Error deleting tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Initialize and start server
async function startServer() {
    await initDataFile();
    
    app.listen(PORT, () => {
        console.log(`🎋 Tanabata 3D Server running on http://localhost:${PORT}`);
        console.log(`📱 Mobile access: http://[your-ip]:${PORT}`);
        console.log(`💾 Data stored in: ${TANZAKU_FILE}`);
    });
}

startServer().catch(console.error);