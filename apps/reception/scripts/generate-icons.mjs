import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(root, '..', 'installer-branding');
// NOT: `resources/logo.svg` (uygulama içi renderer'da <img> ile Chromium tarafından
// gösteriliyor) `feGaussianBlur`/`feMerge` filtresi ve gömülü `font-family` metni
// içeriyor — bunlar Chromium'da sorunsuz render olur ama bu script'in kullandığı
// `sharp` (libvips/librsvg) ile derleme makinesinde güvenilir şekilde rasterize
// OLMAYABİLİR (font kurulu değilse veya librsvg filtreyi desteklemiyorsa), bu da
// görev çubuğu/masaüstü ikonunun soluk/bozuk/boş çıkmasına yol açar. Bu yüzden ikon
// üretimi; filtresiz, metinsiz, yalnızca vektör path + gradient içeren ayrı bir
// kaynaktan (`icon-mark.svg`) yapılır — marka kimliği aynı, rasterizasyon garantili.
const iconSourceSvg = path.join(root, '..', 'resources', 'icon-mark.svg');

async function main() {
  if (!fs.existsSync(iconSourceSvg)) {
    throw new Error(`İkon kaynağı bulunamadı: ${iconSourceSvg}`);
  }

  fs.mkdirSync(buildDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(iconSourceSvg).resize(size, size, { fit: 'contain' }).png().toBuffer()),
  );

  // Her boyutun gerçekten görünür piksel içerdiğini doğrula (tamamen saydam/boş bir
  // rasterizasyonu — örn. filtre/metin başarısızlığının sessizce ürettiği boş bir
  // PNG'yi — build zamanında yakalar, paketlenip fark edilmeden dağıtılmasını önler.
  for (const [index, buffer] of pngBuffers.entries()) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let hasOpaquePixel = false;
    for (let i = 3; i < data.length; i += info.channels) {
      if (data[i] > 10) {
        hasOpaquePixel = true;
        break;
      }
    }
    if (!hasOpaquePixel) {
      throw new Error(`İkon ${sizes[index]}px boyutunda tamamen saydam/boş rasterize oldu — kaynak SVG kontrol edilmeli.`);
    }
  }

  const ico = await pngToIco(pngBuffers);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
  const png512 = path.join(buildDir, 'icon.png');
  const resourcesDir = path.join(root, '..', 'resources');
  await sharp(iconSourceSvg).resize(512, 512, { fit: 'contain' }).png().toFile(png512);
  fs.copyFileSync(png512, path.join(resourcesDir, 'icon.png'));
  fs.copyFileSync(path.join(buildDir, 'icon.ico'), path.join(resourcesDir, 'icon.ico'));

  console.log('Icons generated in installer-branding/ (source: resources/icon-mark.svg)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
