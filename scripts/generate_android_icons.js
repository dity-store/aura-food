import { Jimp } from 'jimp';
import path from 'path';
import fs from 'fs';

const SOURCE_ICON = path.join(process.cwd(), 'public', 'logo.png');
const RES_DIR = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

const CONFIGS = [
  { density: 'mipmap-ldpi', iconSize: 36, foregroundSize: 81 },
  { density: 'mipmap-mdpi', iconSize: 48, foregroundSize: 108 },
  { density: 'mipmap-hdpi', iconSize: 72, foregroundSize: 162 },
  { density: 'mipmap-xhdpi', iconSize: 96, foregroundSize: 216 },
  { density: 'mipmap-xxhdpi', iconSize: 144, foregroundSize: 324 },
  { density: 'mipmap-xxxhdpi', iconSize: 192, foregroundSize: 432 }
];

async function generate() {
  try {
    console.log(`Loading source icon from: ${SOURCE_ICON}`);
    if (!fs.existsSync(SOURCE_ICON)) {
      throw new Error(`Source icon not found at ${SOURCE_ICON}`);
    }

    // Read the original image
    const image = await Jimp.read(SOURCE_ICON);

    // Overwrite resources/icon.png and assets/icon.png with high-quality 1024x1024 logo
    console.log('Updating high-resolution resource and asset icons...');
    const highResIcon = image.clone().resize({ w: 1024, h: 1024 });
    
    const resourcesPath = path.join(process.cwd(), 'resources');
    const assetsPath = path.join(process.cwd(), 'assets');
    
    if (fs.existsSync(resourcesPath)) {
      await highResIcon.write(path.join(resourcesPath, 'icon.png'));
    }
    if (fs.existsSync(assetsPath)) {
      await highResIcon.write(path.join(assetsPath, 'icon.png'));
    }

    for (const config of CONFIGS) {
      const targetDir = path.join(RES_DIR, config.density);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      console.log(`Generating icons for ${config.density}...`);

      // 1. Regular icon (ic_launcher.png)
      const regularIcon = image.clone().resize({ w: config.iconSize, h: config.iconSize });
      await regularIcon.write(path.join(targetDir, 'ic_launcher.png'));

      // 2. Round icon (ic_launcher_round.png)
      const roundIcon = image.clone().resize({ w: config.iconSize, h: config.iconSize });
      await roundIcon.write(path.join(targetDir, 'ic_launcher_round.png'));

      // 3. Foreground icon (ic_launcher_foreground.png)
      const fgSize = config.foregroundSize;
      
      // We resize the logo so it sits within the safe area of adaptive icon (safe area is 66% of the size)
      const logoInFgSize = Math.round(fgSize * 0.65);
      const resizedLogo = image.clone().resize({ w: logoInFgSize, h: logoInFgSize });

      // Create a transparent container using Jimp
      const canvas = new Jimp({ width: fgSize, height: fgSize, color: 0x00000000 });
      
      // Center the resized logo onto the transparent canvas
      const xOffset = Math.round((fgSize - logoInFgSize) / 2);
      const yOffset = Math.round((fgSize - logoInFgSize) / 2);
      
      canvas.composite(resizedLogo, xOffset, yOffset);
      await canvas.write(path.join(targetDir, 'ic_launcher_foreground.png'));

      // 4. Solid background icon (ic_launcher_background.png)
      // This overrides the default blue grid background with a clean white canvas
      const bgCanvas = new Jimp({ width: fgSize, height: fgSize, color: 0xFFFFFFFF });
      await bgCanvas.write(path.join(targetDir, 'ic_launcher_background.png'));
    }

    console.log('✨ All Android launcher icons generated successfully from logo.png!');
  } catch (error) {
    console.error('❌ Error generating launcher icons:', error);
    process.exit(1);
  }
}

generate();
