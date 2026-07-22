// src/shareCard.js — turns an outfit into a shareable, Instagram-story-shaped
// image (1080×1920) using plain Canvas 2D. No new dependencies.
//
// Deliberately uses OOTD's own swatch-palette look for every share, rather
// than the Unsplash stock photo — it's the app's visual signature, and it
// sidesteps any cross-origin/licensing complications that come with
// re-exporting a third-party photo into a downloadable file.
//
// Note: canvas rendering can only really be judged in a live browser —
// this compiles and runs, but the exact layout is worth eyeballing on a
// real screen once deployed, since this sandbox can't render a canvas.

const W = 1080, H = 1920;
const INK = "#1C1826";
const PAPER = "#FFFFFF";
const VIOLET = "#5B2EDD";
const GRAY = "#77716A";
const LINE = "#E3E0D9";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || "").split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateStoryImage(outfit) {
  // Make sure the brand fonts are actually loaded before measuring/drawing —
  // otherwise canvas silently falls back to a generic system font.
  await Promise.all([
    document.fonts.load("italic 500 60px 'Bodoni Moda'"),
    document.fonts.load("italic 400 32px 'Bodoni Moda'"),
    document.fonts.load("600 24px 'Outfit'"),
    document.fonts.load("500 32px 'Outfit'"),
  ]).catch(() => {}); // worst case, draw with the browser default font instead

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";

  // Violet backdrop
  ctx.fillStyle = VIOLET;
  ctx.fillRect(0, 0, W, H);

  // Masthead
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "italic 500 46px 'Bodoni Moda', serif";
  ctx.fillText("OOTD", 64, 100);
  ctx.font = "600 22px 'Outfit', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText("YOUR AI STYLIST", 240, 96);

  // Paper card
  const padX = 56, cardY = 160, cardW = W - padX * 2, cardH = H - cardY - 130;
  roundRect(ctx, padX, cardY, cardW, cardH, 36);
  ctx.fillStyle = PAPER;
  ctx.fill();

  const innerX = padX + 48;
  const innerW = cardW - 96;
  let y = cardY + 64;

  // Eyebrow
  ctx.fillStyle = VIOLET;
  ctx.font = "600 24px 'Outfit', sans-serif";
  ctx.fillText(`LOOK · ${(outfit.budget || "").toUpperCase()}`, innerX, y);
  y += 60;

  // Outfit name, wrapped
  ctx.fillStyle = INK;
  ctx.font = "italic 500 60px 'Bodoni Moda', serif";
  wrapText(ctx, outfit.name || "", innerW).forEach((line) => {
    ctx.fillText(line, innerX, y);
    y += 68;
  });
  y += 28;

  // Palette strip — the app's signature look
  const items = outfit.items || [];
  const stripH = 340;
  if (items.length) {
    const chipW = innerW / items.length;
    items.forEach((it, i) => {
      ctx.fillStyle = it.color_hex || "#cccccc";
      const x = innerX + i * chipW;
      roundRect(ctx, x, y, chipW - (i < items.length - 1 ? 6 : 0), stripH, 18);
      ctx.fill();
    });
  }
  y += stripH + 44;

  // Item names (first 5, so the layout stays predictable)
  ctx.font = "500 32px 'Outfit', sans-serif";
  items.slice(0, 5).forEach((it) => {
    ctx.fillStyle = it.color_hex || "#cccccc";
    ctx.beginPath();
    ctx.arc(innerX + 14, y - 11, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(it.name, innerX + 44, y);
    y += 50;
  });
  y += 20;

  // Dashed divider
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(innerX, y);
  ctx.lineTo(innerX + innerW, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += 48;

  // Stylist's note
  ctx.fillStyle = VIOLET;
  ctx.font = "600 22px 'Outfit', sans-serif";
  ctx.fillText("STYLIST'S NOTE", innerX, y);
  y += 42;
  ctx.fillStyle = GRAY;
  ctx.font = "italic 400 32px 'Bodoni Moda', serif";
  wrapText(ctx, outfit.why || "", innerW).slice(0, 4).forEach((line) => {
    ctx.fillText(line, innerX, y);
    y += 42;
  });

  // Footer CTA — every share is a small ad for the app
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 30px 'Outfit', sans-serif";
  ctx.fillText("Styled by OOTD", W / 2, H - 70);
  ctx.font = "400 24px 'Outfit', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText("Never wonder what to wear again", W / 2, H - 36);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed."))), "image/png", 0.95);
  });
}

/**
 * Generates the image, then either opens the native share sheet (mobile
 * Chrome/Safari) or falls back to a plain download (desktop, or if the
 * person backs out of sharing manually — which is treated as a no-op, not an error).
 */
export async function shareOrDownloadOutfit(outfit) {
  const blob = await generateStoryImage(outfit);
  const filename = `ootd-${(outfit.name || "look").replace(/[^\w]+/g, "-").toLowerCase()}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: outfit.name, text: "Styled by OOTD" });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled"; // person backed out — not an error
      // any other share failure: fall through to a plain download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}