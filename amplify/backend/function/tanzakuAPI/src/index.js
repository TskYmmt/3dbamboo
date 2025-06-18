const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// 環境変数からバケット名を取得（Amplifyが自動設定）
const BUCKET_NAME = process.env.STORAGE_TANZAKUS3_BUCKETNAME;
const DATA_KEY = 'tanzaku_data.json';

// CORSヘッダー
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

// S3からデータを読み込む
const loadTanzaku = async () => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: DATA_KEY
    };
    const data = await s3.getObject(params).promise();
    return JSON.parse(data.Body.toString());
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      // ファイルが存在しない場合は空配列を返す
      return [];
    }
    console.error('Error loading tanzaku:', error);
    throw error;
  }
};

// S3にデータを保存
const saveTanzaku = async (tanzakuList) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: DATA_KEY,
    Body: JSON.stringify(tanzakuList, null, 2),
    ContentType: 'application/json'
  };
  await s3.putObject(params).promise();
};

// メインハンドラー
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // プリフライトリクエストへの対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  const path = event.path;
  const method = event.httpMethod;
  
  try {
    // GET /api/tanzaku
    if (method === 'GET' && path === '/api/tanzaku') {
      const tanzakuList = await loadTanzaku();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, tanzaku: tanzakuList })
      };
    }
    
    // POST /api/tanzaku
    if (method === 'POST' && path === '/api/tanzaku') {
      const body = JSON.parse(event.body);
      const { position, rotation, textData, timestamp } = body;
      
      if (!position || !rotation || !textData) {
        return {
          statusCode: 400,
          headers,
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
      
      // 画像短冊の場合の追加フィールド
      if (body.isImageTanzaku) {
        newTanzaku.isImageTanzaku = body.isImageTanzaku;
        newTanzaku.imageIndex = body.imageIndex;
        newTanzaku.imagePath = body.imagePath;
      }
      
      tanzakuList.push(newTanzaku);
      await saveTanzaku(tanzakuList);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, tanzaku: newTanzaku })
      };
    }
    
    // PUT /api/tanzaku/{id}
    if (method === 'PUT' && path.startsWith('/api/tanzaku/')) {
      const id = path.split('/').pop();
      const body = JSON.parse(event.body);
      const { position, rotation } = body;
      
      if (!position || !rotation) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing position or rotation' })
        };
      }
      
      const tanzakuList = await loadTanzaku();
      const tanzakuIndex = tanzakuList.findIndex(t => t.id === id);
      
      if (tanzakuIndex === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Tanzaku not found' })
        };
      }
      
      tanzakuList[tanzakuIndex].position = position;
      tanzakuList[tanzakuIndex].rotation = rotation;
      tanzakuList[tanzakuIndex].lastModified = new Date().toISOString();
      
      // 画像短冊の場合の更新
      if (body.isImageTanzaku) {
        tanzakuList[tanzakuIndex].isImageTanzaku = body.isImageTanzaku;
        tanzakuList[tanzakuIndex].imageIndex = body.imageIndex;
        tanzakuList[tanzakuIndex].imagePath = body.imagePath;
      }
      
      await saveTanzaku(tanzakuList);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, tanzaku: tanzakuList[tanzakuIndex] })
      };
    }
    
    // DELETE /api/tanzaku/{id}
    if (method === 'DELETE' && path.startsWith('/api/tanzaku/')) {
      const id = path.split('/').pop();
      const tanzakuList = await loadTanzaku();
      const filteredList = tanzakuList.filter(t => t.id !== id);
      
      if (filteredList.length === tanzakuList.length) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Tanzaku not found' })
        };
      }
      
      await saveTanzaku(filteredList);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Tanzaku deleted' })
      };
    }
    
    // 404 - Not Found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'Not found' })
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server error' })
    };
  }
};