'use strict';

// Change this value to set the website's default lettering.
const DEFAULT_TEXT = 'NETDIR://XXXXXXX.WEB';
const DEFAULT_GLITCH = 0;
const WIDTH = 1754, HEIGHT = 987;
const STORAGE_KEY = 'netdir-display-v1';
const canvas = document.querySelector('#lettering');
const ctx = canvas.getContext('2d');
const dialog = document.querySelector('#settings');
const textInput = document.querySelector('#custom-text');
const glitchInput = document.querySelector('#glitch');
const status = document.querySelector('#status');
const background = document.querySelector('.background');
const params = new URLSearchParams(location.search);
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
function sanitizeText(value) {
  return String(value ?? DEFAULT_TEXT).replace(/[\r\n\t]/g, ' ').slice(0, 100);
}
function sanitizeGlitch(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : DEFAULT_GLITCH;
}
const hasSharedText = params.has('text');
let currentText = sanitizeText(hasSharedText ? params.get('text') : saved.text);
let currentGlitch = sanitizeGlitch(params.get('glitch') ?? (hasSharedText ? DEFAULT_GLITCH : saved.glitch ?? DEFAULT_GLITCH));
textInput.value = currentText;
glitchInput.value = currentGlitch;

// A stable noise pattern keeps both the live view and downloaded PNG identical.
function randomAt(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function render() {
  const text = currentText.trim() || DEFAULT_TEXT;
  const layer = document.createElement('canvas');
  layer.width = WIDTH; layer.height = HEIGHT;
  const paint = layer.getContext('2d');
  // Match the reference's 48 px capitals and open tracking without stretching
  // the glyphs horizontally. The display font is separate from the settings UI.
  let size = 75;
  let tracking = 1.7;
  const characters = Array.from(text);
  paint.font = `600 ${size}px DisplayTerminal, "Microsoft YaHei", sans-serif`;
  const cap = paint.measureText('NETDIR');
  size *= 48 / (cap.actualBoundingBoxAscent + cap.actualBoundingBoxDescent);
  paint.font = `600 ${size}px DisplayTerminal, "Microsoft YaHei", sans-serif`;
  const getWidth = () => characters.reduce((total, char) => total + paint.measureText(char).width, 0) + Math.max(0, characters.length - 1) * tracking;
  const scale = Math.min(1, 1080 / getWidth());
  size *= scale; tracking *= scale;
  paint.font = `600 ${size}px DisplayTerminal, "Microsoft YaHei", sans-serif`;
  paint.textAlign = 'left'; paint.textBaseline = 'alphabetic';
  // A small contour expansion gives a weight between SemiBold and Bold.
  paint.lineWidth = 1.7 * scale;
  paint.lineJoin = 'round';
  const metrics = paint.measureText(text);
  const baseline = 502 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  const drawTrackedText = () => {
    let x = 859 - getWidth() / 2;
    for (const char of characters) {
      paint.strokeText(char, x, baseline);
      paint.fillText(char, x, baseline);
      x += paint.measureText(char).width + tracking;
    }
  };
  paint.fillStyle = '#12fae0';
  paint.strokeStyle = paint.fillStyle;
  drawTrackedText();

  // Scanlines belong to the phosphor strokes, not to the surrounding bloom.
  paint.save(); paint.globalCompositeOperation = 'source-atop';
  for (let y = 420; y < 585; y += 5) {
    paint.fillStyle = 'rgba(8,45,31,.07)'; paint.fillRect(0, y, WIDTH, 2);
    paint.fillStyle = 'rgba(215,255,245,.10)'; paint.fillRect(0, y + 2, WIDTH, 1);
  }
  paint.restore();

  const strokes = document.createElement('canvas');
  strokes.width = WIDTH; strokes.height = HEIGHT;
  const strokeContext = strokes.getContext('2d');
  const amount = currentGlitch / 100;
  if (amount === 0) {
    strokeContext.drawImage(layer, 0, 0);
  } else for (let y = 420; y < 585; y += 2) {
    const active = randomAt(y) < amount * .55 && y > 470 && y < 532;
    const shift = active ? (randomAt(y + 8) - .5) * 34 * amount : 0;
    strokeContext.drawImage(layer, 0, y, WIDTH, 2, shift, y, WIDTH, 2);
  }

  // The reference has diffuse optical bloom, rather than a tight neon outline.
  // A slightly pale halo lifts the surrounding panel instead of darkening it.
  paint.clearRect(0, 0, WIDTH, HEIGHT);
  paint.drawImage(strokes, 0, 0);
  paint.globalCompositeOperation = 'source-in';
  paint.fillStyle = '#54ffe8';
  paint.fillRect(0, 0, WIDTH, HEIGHT);
  paint.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  for (const [radius, opacity] of [[34, .68], [13, .52], [3, .37]]) {
    ctx.filter = `blur(${radius}px)`;
    ctx.globalAlpha = opacity;
    ctx.drawImage(layer, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.filter = 'blur(0.45px)';
  ctx.drawImage(strokes, 0, 0);
  ctx.restore();
  canvas.setAttribute('aria-label', text);
  document.querySelector('#glitch-value').value = `${currentGlitch}%`;
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({text:currentText, glitch:currentGlitch})); } catch {}
  // Keep a shared URL in sync so reloading it does not restore old lettering.
  if (location.protocol !== 'file:') {
    const url = new URL(location.href);
    url.searchParams.set('text', currentText);
    url.searchParams.set('glitch', currentGlitch);
    history.replaceState(null, '', url);
  }
}
function update() {
  currentText = sanitizeText(textInput.value);
  currentGlitch = sanitizeGlitch(glitchInput.value);
  status.textContent = '';
  render(); persist();
}
function openSettings() {
  if (!dialog.open) dialog.showModal();
  textInput.focus(); textInput.select();
}
document.querySelector('#edit-text').addEventListener('click', openSettings);
document.querySelector('#close-settings').addEventListener('click', () => dialog.close());
document.querySelector('#settings-form').addEventListener('submit', event => { event.preventDefault(); update(); dialog.close(); });
textInput.addEventListener('input', update);
glitchInput.addEventListener('input', update);
document.querySelector('#reset').addEventListener('click', () => {
  textInput.value = DEFAULT_TEXT; glitchInput.value = DEFAULT_GLITCH; update();
});
document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'e' && !dialog.open && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); openSettings();
  }
});
dialog.addEventListener('click', event => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
});
document.querySelector('#copy-link').addEventListener('click', async () => {
  if (location.protocol === 'file:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
    status.textContent = '当前是本地预览。部署到 GitHub Pages 后即可复制公开分享链接。'; return;
  }
  const url = new URL(location.href);
  url.searchParams.set('text', currentText.trim() || DEFAULT_TEXT);
  url.searchParams.set('glitch', currentGlitch);
  try { await navigator.clipboard.writeText(url.href); status.textContent = '已复制分享链接，打开即可显示这段文字。'; }
  catch { status.textContent = `请复制此链接：${url.href}`; }
});
const fontReady = document.fonts.load('600 75px DisplayTerminal').catch(() => []);
document.querySelector('#download').addEventListener('click', async () => {
  try {
    await fontReady; await background.decode(); render();
    const result = document.createElement('canvas'); result.width = WIDTH; result.height = HEIGHT;
    const output = result.getContext('2d'); output.drawImage(background, 0, 0); output.drawImage(canvas, 0, 0);
    result.toBlob(blob => {
      if (!blob) { status.textContent = '图片生成失败，请重试。'; return; }
      const link = document.createElement('a'); const url = URL.createObjectURL(blob);
      link.href = url; link.download = 'netdir.png'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = '已生成 1754 × 987 PNG 图片。';
    }, 'image/png');
  } catch { status.textContent = '请通过本地 HTTP 服务或 GitHub Pages 打开网页后下载图片。'; }
});
render(); fontReady.then(render);
