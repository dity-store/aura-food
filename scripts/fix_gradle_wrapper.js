import fs from 'fs';
import path from 'path';

const JAR_URL = 'https://raw.githubusercontent.com/gradle/gradle/v8.5.0/gradle/wrapper/gradle-wrapper.jar';
const TARGET_PATH = path.join(process.cwd(), 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');

async function fixWrapper() {
  try {
    console.log(`Downloading sound gradle-wrapper.jar from: ${JAR_URL}`);
    const response = await fetch(JAR_URL);
    if (!response.ok) {
      throw new Error(`Failed to download gradle-wrapper.jar: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer);
    
    // Ensure directories exist
    const dir = path.dirname(TARGET_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(TARGET_PATH, data);
    console.log(`Successfully fixed and wrote clean gradle-wrapper.jar to: ${TARGET_PATH}`);
    console.log(`Size of written jar: ${data.length} bytes`);
  } catch (error) {
    console.error('Error fixing gradle wrapper:', error);
    process.exit(1);
  }
}

fixWrapper();
