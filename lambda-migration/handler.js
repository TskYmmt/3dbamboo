const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const BUCKET = process.env.TANZAKU_BUCKET;
const DATA_KEY = 'tanzaku_data.json';

// S3からデータを読み込む
const loadTanzaku = async () => {
  try {
    const params = {
      Bucket: BUCKET,
      Key: DATA_KEY
    };
    const data = await s3.getObject(params).promise();
    return JSON.parse(data.Body.toString());
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      return [];
    }
    throw error;
  }
};

// S3にデータを保存
const saveTanzaku = async (tanzakuList) => {
  const params = {
    Bucket: BUCKET,
    Key: DATA_KEY,
    Body: JSON.stringify(tanzakuList, null, 2),
    ContentType: 'application/json'
  };
  await s3.putObject(params).promise();
};

// Lambda関数
module.exports.getTanzaku = async (event) => {
  try {
    const tanzakuList = await loadTanzaku();
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, tanzaku: tanzakuList })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Failed to load tanzaku' })
    };
  }
};

module.exports.createTanzaku = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { position, rotation, textData, timestamp } = body;
    
    if (!position || !rotation || !textData) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }
    
    const tanzakuList = await loadTanzaku();
    const newTanzaku = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      position,
      rotation,
      textData,
      timestamp: timestamp || new Date().toISOString(),
      author: body.author || 'Anonymous'
    };

    if (body.isImageTanzaku) {
      newTanzaku.isImageTanzaku = body.isImageTanzaku;
      newTanzaku.imageIndex = body.imageIndex;
      newTanzaku.imagePath = body.imagePath;
    }
    
    tanzakuList.push(newTanzaku);
    await saveTanzaku(tanzakuList);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, tanzaku: newTanzaku })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Server error' })
    };
  }
};

module.exports.updateTanzaku = async (event) => {
  try {
    const { id } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { position, rotation } = body;
    
    if (!position || !rotation) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Missing position or rotation' })
      };
    }
    
    const tanzakuList = await loadTanzaku();
    const tanzakuIndex = tanzakuList.findIndex(t => t.id === id);
    
    if (tanzakuIndex === -1) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Tanzaku not found' })
      };
    }
    
    tanzakuList[tanzakuIndex].position = position;
    tanzakuList[tanzakuIndex].rotation = rotation;
    tanzakuList[tanzakuIndex].lastModified = new Date().toISOString();
    
    if (body.isImageTanzaku) {
      tanzakuList[tanzakuIndex].isImageTanzaku = body.isImageTanzaku;
      tanzakuList[tanzakuIndex].imageIndex = body.imageIndex;
      tanzakuList[tanzakuIndex].imagePath = body.imagePath;
    }
    
    await saveTanzaku(tanzakuList);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, tanzaku: tanzakuList[tanzakuIndex] })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Server error' })
    };
  }
};