import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const indexFile = path.join(distDir, 'index.html');
const notFoundFile = path.join(distDir, '404.html');

try {
    if (fs.existsSync(indexFile)) {
        fs.copyFileSync(indexFile, notFoundFile);
        console.log('✅ Created 404.html from index.html for SPA routing');
    } else {
        console.error('❌ Error: dist/index.html not found. Build likely failed.');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Error creating 404.html:', error);
    process.exit(1);
}
