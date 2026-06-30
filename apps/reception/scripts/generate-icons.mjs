import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(root, '..', 'installer-branding');
const logoSvg = path.join(root, '..', 'resources', 'logo.svg');

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(logoSvg).resize(size, size, { fit: 'contain' }).png().toBuffer()),
  );

  const ico = await pngToIco(pngBuffers);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
  const png512 = path.join(buildDir, 'icon.png');
  const resourcesDir = path.join(root, '..', 'resources');
  await sharp(logoSvg).resize(512, 512, { fit: 'contain' }).png().toFile(png512);
  fs.copyFileSync(png512, path.join(resourcesDir, 'icon.png'));

  console.log('Icons generated in installer-branding/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
