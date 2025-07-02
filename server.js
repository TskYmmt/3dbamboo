const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 8005;
const TANZAKU_FILE = path.join(__dirname, 'tanzaku_data.json');

// Memory cache and delayed write system
let tanzakuCache = [];
let writeTimer = null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Large limit for canvas data
app.use(express.static(__dirname)); // Serve static files

// Health check endpoint for AWS
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize memory cache from file
async function initCache() {
    try {
        await fs.access(TANZAKU_FILE);
        const data = await fs.readFile(TANZAKU_FILE, 'utf8');
        tanzakuCache = JSON.parse(data);
        console.log(`Loaded ${tanzakuCache.length} tanzaku into cache`);
    } catch (error) {
        // File doesn't exist, create it with empty array
        tanzakuCache = [];
        await fs.writeFile(TANZAKU_FILE, JSON.stringify([], null, 2));
        console.log('Created tanzaku_data.json and initialized cache');
    }
}

// Schedule delayed file write (1 second after last update)
function scheduleWrite() {
    if (writeTimer) {
        clearTimeout(writeTimer);
    }
    writeTimer = setTimeout(async () => {
        try {
            await fs.writeFile(TANZAKU_FILE, JSON.stringify(tanzakuCache, null, 2));
            console.log('Tanzaku data saved to file');
        } catch (error) {
            console.error('Error saving tanzaku to file:', error);
        }
    }, 1000);
}

// Legacy functions - kept for compatibility but no longer used
async function loadTanzaku() {
    return tanzakuCache;
}

async function saveTanzaku(tanzakuList) {
    tanzakuCache = tanzakuList;
    scheduleWrite();
    return true;
}

// Routes

// Get all tanzaku
app.get('/api/tanzaku', (req, res) => {
    try {
        res.json({ success: true, tanzaku: tanzakuCache });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load tanzaku' });
    }
});

// Add new tanzaku
app.post('/api/tanzaku', (req, res) => {
    try {
        const { position, rotation, textData, timestamp } = req.body;
        
        if (!position || !rotation || !textData) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
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
        
        tanzakuCache.push(newTanzaku);
        scheduleWrite();
        
        res.json({ success: true, tanzaku: newTanzaku });
    } catch (error) {
        console.error('Error adding tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Update tanzaku position
app.put('/api/tanzaku/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { position, rotation } = req.body;
        
        if (!position || !rotation) {
            return res.status(400).json({ success: false, error: 'Missing position or rotation' });
        }
        
        const tanzakuIndex = tanzakuCache.findIndex(t => t.id === id);
        
        if (tanzakuIndex === -1) {
            return res.status(404).json({ success: false, error: 'Tanzaku not found' });
        }
        
        tanzakuCache[tanzakuIndex].position = position;
        tanzakuCache[tanzakuIndex].rotation = rotation;
        tanzakuCache[tanzakuIndex].lastModified = new Date().toISOString();
        
        // Update image tanzaku specific fields if present
        if (req.body.isImageTanzaku) {
            tanzakuCache[tanzakuIndex].isImageTanzaku = req.body.isImageTanzaku;
            tanzakuCache[tanzakuIndex].imageIndex = req.body.imageIndex;
            tanzakuCache[tanzakuIndex].imagePath = req.body.imagePath;
        }
        
        scheduleWrite();
        res.json({ success: true, tanzaku: tanzakuCache[tanzakuIndex] });
    } catch (error) {
        console.error('Error updating tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Clear all tanzaku (for developer mode) - Must be before /:id route
app.delete('/api/tanzaku/clear', (req, res) => {
    try {
        console.log('Clearing all tanzaku...');
        tanzakuCache = [];
        scheduleWrite();
        console.log('All tanzaku cleared successfully');
        res.json({ success: true, message: 'All tanzaku cleared' });
    } catch (error) {
        console.error('Error clearing tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Delete tanzaku (optional)
app.delete('/api/tanzaku/:id', (req, res) => {
    try {
        const { id } = req.params;
        const originalLength = tanzakuCache.length;
        tanzakuCache = tanzakuCache.filter(t => t.id !== id);
        
        if (tanzakuCache.length === originalLength) {
            return res.status(404).json({ success: false, error: 'Tanzaku not found' });
        }
        
        scheduleWrite();
        res.json({ success: true, message: 'Tanzaku deleted' });
    } catch (error) {
        console.error('Error deleting tanzaku:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Initialize and start server
async function startServer() {
    await initCache();
    
    app.listen(PORT, () => {
        console.log(`🎋 Tanabata 3D Server running on http://localhost:${PORT}`);
        console.log(`📱 Mobile access: http://[your-ip]:${PORT}`);
        console.log(`💾 Data stored in: ${TANZAKU_FILE}`);
        console.log(`⚡ Cache initialized with ${tanzakuCache.length} tanzaku`);
    });
}

startServer().catch(console.error);