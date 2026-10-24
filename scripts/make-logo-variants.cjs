/**
 * Génère les variantes du logo XTER Transit depuis public/logo-src.png :
 *  - public/logo.png        : fond transparent, couleurs d'origine (fonds clairs)
 *  - public/logo-white.png  : fond transparent, bleu marine → blanc (fonds bleu nuit)
 *  - src/app/icon.png       : favicon 256×256 (fond bleu nuit arrondi + logo blanc)
 */
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

async function main() {
  const src = await loadImage(fs.readFileSync(path.join("public", "logo-src.png")));
  const W = src.width, H = src.height;

  // 1. Détramage du fond blanc + recadrage sur le contenu
  const base = createCanvas(W, H);
  const bctx = base.getContext("2d");
  bctx.drawImage(src, 0, 0);
  const img = bctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const min = Math.min(r, g, b);
    if (min >= 235) {
      d[i + 3] = 0; // fond blanc → transparent
    } else if (min > 205) {
      // liseré d'anticrénelage → alpha proportionnel
      d[i + 3] = Math.round(255 * (1 - (min - 205) / 30));
    }
  }
  bctx.putImageData(img, 0, 0);

  // bbox du contenu
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 8;
  const cw = Math.min(W - 1, maxX + pad) - Math.max(0, minX - pad) + 1;
  const ch = Math.min(H - 1, maxY + pad) - Math.max(0, minY - pad) + 1;
  const ox = Math.max(0, minX - pad);
  const oy = Math.max(0, minY - pad);

  const crop = createCanvas(cw, ch);
  crop.getContext("2d").drawImage(base, ox, oy, cw, ch, 0, 0, cw, ch);
  fs.writeFileSync(path.join("public", "logo.png"), crop.toBuffer("image/png"));

  // 2. Variante claire : bleu marine → blanc (l'orange est conservé)
  const light = createCanvas(cw, ch);
  const lctx = light.getContext("2d");
  lctx.drawImage(crop, 0, 0);
  const limg = lctx.getImageData(0, 0, cw, ch);
  const ld = limg.data;
  for (let i = 0; i < ld.length; i += 4) {
    const r = ld[i], g = ld[i + 1], b = ld[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (ld[i + 3] > 0 && b >= r && luminance < 170) {
      ld[i] = 255; ld[i + 1] = 255; ld[i + 2] = 255;
    }
  }
  lctx.putImageData(limg, 0, 0);
  fs.writeFileSync(path.join("public", "logo-white.png"), light.toBuffer("image/png"));

  // 3. Favicon 256×256 : carré bleu nuit arrondi + variante claire centrée (75 %)
  const S = 256;
  const icon = createCanvas(S, S);
  const ictx = icon.getContext("2d");
  ictx.beginPath();
  const r = 48;
  ictx.moveTo(r, 0);
  ictx.arcTo(S, 0, S, S, r);
  ictx.arcTo(S, S, 0, S, r);
  ictx.arcTo(0, S, 0, 0, r);
  ictx.arcTo(0, 0, S, 0, r);
  ictx.closePath();
  ictx.clip();
  ictx.fillStyle = "#0d1c31";
  ictx.fillRect(0, 0, S, S);
  const scale = (S * 0.75) / cw;
  const dw = cw * scale, dh = ch * scale;
  ictx.drawImage(light, (S - dw) / 2, (S - dh) / 2, dw, dh);
  fs.writeFileSync(path.join("src", "app", "icon.png"), icon.toBuffer("image/png"));

  console.log("✓ public/logo.png", cw + "x" + ch);
  console.log("✓ public/logo-white.png");
  console.log("✓ src/app/icon.png (favicon)");
}

main().catch((e) => { console.error(e); process.exit(1); });
