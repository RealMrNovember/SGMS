import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = join(__dirname, '../../reception/resources/icon-mark.svg');
const assetsDir = join(__dirname, '../assets');

async function assertNotBlank(buffer, label) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  let hasOpaquePixel = false;
  for (let i = 3; i < data.length; i += channels) {
    if (data[i] > 10) {
      hasOpaquePixel = true;
      break;
    }
  }
  if (!hasOpaquePixel) {
    throw new Error(`${label} tamamen şeffaf çıktı — kaynak SVG rasterizasyonu başarısız`);
  }
}

async function main() {
  // 1024x1024 opaque icon on brand navy background (app store / launcher icon)
  const icon = await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: '#0b1220' },
  })
    .composite([{ input: await sharp(source).resize(820, 820).toBuffer(), gravity: 'center' }])
    .png()
    .toBuffer();
  await assertNotBlank(icon, 'icon.png');
  await sharp(icon).toFile(join(assetsDir, 'icon.png'));

  // Android adaptive icon: transparent foreground, solid background, monochrome
  const foreground = await sharp(source).resize(660, 660).extend({
    top: 182, bottom: 182, left: 182, right: 182,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();
  await assertNotBlank(foreground, 'android-icon-foreground.png');
  await sharp(foreground).toFile(join(assetsDir, 'android-icon-foreground.png'));

  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#0b1220' } })
    .png()
    .toFile(join(assetsDir, 'android-icon-background.png'));

  const monochrome = await sharp(source)
    .resize(660, 660)
    .grayscale()
    .extend({ top: 182, bottom: 182, left: 182, right: 182, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(monochrome).toFile(join(assetsDir, 'android-icon-monochrome.png'));

  await sharp(icon).resize(48, 48).toFile(join(assetsDir, 'favicon.png'));
  await sharp(icon).resize(1024, 1024).toFile(join(assetsDir, 'splash-icon.png'));

  console.log('Mobil ikonlar üretildi (kaynak: reception/resources/icon-mark.svg)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
