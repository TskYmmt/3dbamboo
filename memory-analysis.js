#!/usr/bin/env node

// Three.jsの短冊3Dオブジェクトのメモリ使用量分析

console.log('📊 Three.js 短冊3Dオブジェクト メモリ使用量分析');
console.log('=======================================\n');

// 短冊1個の構成要素
const tanzakuComponents = {
    // 1. メインの短冊（BoxGeometry）
    mainGeometry: {
        type: 'BoxGeometry',
        size: '1.5 x 3 x 0.05',
        vertices: 24, // Box geometry standard
        faces: 12,
        vertexSize: 3 * 4, // x,y,z * 4 bytes (float32)
        normalSize: 3 * 4, // normal vector
        uvSize: 2 * 4, // UV coordinates
        indexSize: 12 * 3 * 2 // 12 faces * 3 vertices * 2 bytes (uint16)
    },
    
    // 2. テキスト表面（PlaneGeometry）
    textGeometry: {
        type: 'PlaneGeometry', 
        size: '1.35 x 2.7',
        vertices: 4,
        faces: 2,
        vertexSize: 4 * 3 * 4, // 4 vertices * 3 coords * 4 bytes
        normalSize: 4 * 3 * 4,
        uvSize: 4 * 2 * 4,
        indexSize: 2 * 3 * 2 // 2 faces * 3 vertices * 2 bytes
    },
    
    // 3. テクスチャデータ（手書き文字）
    texture: {
        size: '512x512', // Canvas size for text
        format: 'RGBA',
        bytesPerPixel: 4,
        totalBytes: 512 * 512 * 4 // 1MB per texture
    },
    
    // 4. マテリアル
    materials: {
        mainMaterial: 'MeshPhongMaterial',
        textMaterial: 'MeshBasicMaterial with texture',
        shaderCompilation: 'GPU側でコンパイル'
    }
};

// メモリ計算
function calculateMemoryUsage() {
    const main = tanzakuComponents.mainGeometry;
    const text = tanzakuComponents.textGeometry;
    const texture = tanzakuComponents.texture;
    
    // ジオメトリのメモリ使用量
    const mainGeometrySize = main.vertexSize + main.normalSize + main.uvSize + main.indexSize;
    const textGeometrySize = text.vertexSize + text.normalSize + text.uvSize + text.indexSize;
    
    const geometryTotal = mainGeometrySize + textGeometrySize;
    const textureSize = texture.totalBytes;
    
    // JavaScript オブジェクトのオーバーヘッド
    const jsObjectOverhead = 1024; // Group, Mesh, Material objects
    
    const totalPerTanzaku = geometryTotal + textureSize + jsObjectOverhead;
    
    return {
        geometryTotal,
        textureSize,
        jsObjectOverhead,
        totalPerTanzaku
    };
}

const memory = calculateMemoryUsage();

console.log('🔍 短冊1個あたりのメモリ使用量:');
console.log(`  ジオメトリ: ${(memory.geometryTotal / 1024).toFixed(2)} KB`);
console.log(`  テクスチャ: ${(memory.textureSize / 1024).toFixed(2)} KB`);
console.log(`  JSオブジェクト: ${(memory.jsObjectOverhead / 1024).toFixed(2)} KB`);
console.log(`  合計: ${(memory.totalPerTanzaku / 1024).toFixed(2)} KB`);

console.log('\n📈 スケーリング分析:');
const counts = [30, 64, 100, 200, 331];
counts.forEach(count => {
    const totalMB = (memory.totalPerTanzaku * count) / (1024 * 1024);
    const textureOnlyMB = (memory.textureSize * count) / (1024 * 1024);
    console.log(`  ${count}個: ${totalMB.toFixed(1)}MB (テクスチャのみ: ${textureOnlyMB.toFixed(1)}MB)`);
});

console.log('\n💡 パフォーマンス問題の原因:');
console.log('  1. テクスチャメモリ: 1MB × 短冊数 (最大の問題)');
console.log('  2. ドローコール: 短冊数 × 2 (本体+テキスト)');
console.log('  3. WebGL状態変更: マテリアル/テクスチャ切り替え');
console.log('  4. GPU転送: 大量のテクスチャアップロード');

console.log('\n🚀 最適化案:');
console.log('  1. テクスチャアトラス: 複数テクスチャを1枚に統合');
console.log('  2. インスタンシング: 同じ形状をまとめて描画');
console.log('  3. LOD: 距離に応じてテクスチャ解像度調整');
console.log('  4. カリング: 視界外オブジェクトの描画停止');
console.log('  5. 遅延読み込み: 必要な範囲のみ読み込み');

console.log('\n⚠️  331個での問題:');
console.log('  - VRAM使用量: 約331MB (テクスチャのみ)');
console.log('  - ドローコール: 662回/フレーム');
console.log('  - モバイル端末: VRAMが不足する可能性');
console.log('  - フレームレート: 大幅低下の可能性');