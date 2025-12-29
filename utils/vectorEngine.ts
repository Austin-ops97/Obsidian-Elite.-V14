
export interface VectorOptions {
  tolerance: number; 
  maxWidth: number;
  maxHeight: number;
  superSample: number;
}

/**
 * PIXELPRO High-Precision Vector Engine (Pro-V14.0 - "Obsidian Elite" Edition)
 * 
 * CORE PERFORMANCE & FIDELITY UPDATES:
 * 1. Async Batch Processing: Processes rows in small batches to prevent main-thread freezing.
 * 2. Atomic Weld: Refined 0.5px stroke + 0.2px bleed system to eliminate 100% of renderer seams.
 * 3. 2x Super-Sampling: Optimized balance of extreme resolution vs calculation overhead.
 * 4. Fidelity Focus: Tolerance set to 1 for near-perfect color parity without noise artifacts.
 */
export const traceImageToSVG = async (
  imgUrl: string,
  onProgress: (percent: number) => void,
  options: VectorOptions = { tolerance: 1, maxWidth: 4096, maxHeight: 4096, superSample: 2 }
): Promise<string> => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgUrl;
  });

  const scale = Math.min(options.maxWidth / img.width, options.maxHeight / img.height, 1);
  const targetWidth = Math.floor(img.width * scale * options.superSample);
  const targetHeight = Math.floor(img.height * scale * options.superSample);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas initialization failed");

  // PRE-PROCESS: High-fidelity sampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = new Uint32Array(imageData.data.buffer);
  const visited = new Uint8Array(targetWidth * targetHeight);

  const isColorSimilar = (color1: number, color2: number, tol: number): boolean => {
    if (color1 === color2) return true;
    const a1 = (color1 >> 24) & 0xff;
    const a2 = (color2 >> 24) & 0xff;
    if (a1 < 2 && a2 < 2) return true;
    if (Math.abs(a1 - a2) > tol) return false;
    const b1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const r1 = color1 & 0xff;
    const b2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const r2 = color2 & 0xff;
    return Math.abs(r1 - r2) <= tol && Math.abs(g1 - g2) <= tol && Math.abs(b1 - b2) <= tol;
  };

  const colorPaths: Map<number, string[]> = new Map();
  let processed = 0;
  const total = targetWidth * targetHeight;

  // ELITE BATCH PROCESSING: Iterate in chunks to prevent UI freeze
  const BATCH_ROWS = 25; // Process 25 rows at a time
  for (let batchY = 0; batchY < targetHeight; batchY += BATCH_ROWS) {
    const endY = Math.min(batchY + BATCH_ROWS, targetHeight);
    
    for (let y = batchY; y < endY; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const idx = y * targetWidth + x;
        if (visited[idx]) continue;

        const color = data[idx];
        if (((color >> 24) & 0xff) < 2) {
          visited[idx] = 1;
          processed++;
          continue;
        }

        // Greedy Horizontal
        let rectW = 0;
        while (x + rectW < targetWidth && !visited[idx + rectW] && isColorSimilar(color, data[idx + rectW], options.tolerance)) {
          rectW++;
        }

        // Greedy Vertical
        let rectH = 1;
        let canExpand = true;
        while (canExpand && y + rectH < targetHeight) {
          for (let dw = 0; dw < rectW; dw++) {
            const checkIdx = (y + rectH) * targetWidth + (x + dw);
            if (visited[checkIdx] || !isColorSimilar(color, data[checkIdx], options.tolerance)) {
              canExpand = false;
              break;
            }
          }
          if (canExpand) rectH++;
        }

        // Commit and Mark
        for (let vY = 0; vY < rectH; vY++) {
          for (let vX = 0; vX < rectW; vX++) {
            const vIdx = (y + vY) * targetWidth + (x + vX);
            if (!visited[vIdx]) {
              visited[vIdx] = 1;
              processed++;
            }
          }
        }

        if (!colorPaths.has(color)) colorPaths.set(color, []);
        
        // ATOMIC OVERLAP: 0.2px bleed to physically bond adjacent geometries
        const b = 0.2;
        colorPaths.get(color)!.push(`M${x - b},${y - b}h${rectW + b * 2}v${rectH + b * 2}h-${rectW + b * 2}z`);
      }
    }
    
    // YIELD TO MAIN THREAD
    onProgress(Math.floor((processed / total) * 100));
    await new Promise(r => setTimeout(r, 0));
  }

  const pathElements: string[] = [];
  colorPaths.forEach((dArray, color) => {
    const r = color & 0xff;
    const g = (color >> 8) & 0xff;
    const b = (color >> 16) & 0xff;
    const a = ((color >> 24) & 0xff) / 255;
    const rgba = `rgba(${r},${g},${b},${a.toFixed(4)})`;
    
    // THE ATOMIC WELD:
    // Uses a matching-color stroke of 0.5px to seal the sub-pixel rendering gaps.
    pathElements.push(
      `<path d="${dArray.join('')}" fill="${rgba}" stroke="${rgba}" stroke-width="0.5" stroke-linejoin="round" />`
    );
  });

  return `<svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 ${targetWidth} ${targetHeight}" 
    width="${targetWidth}" 
    height="${targetHeight}"
    shape-rendering="crispEdges"
    style="background:transparent; display:block; image-rendering: -webkit-optimize-contrast; pointer-events: none;"
  >
    ${pathElements.join('')}
  </svg>`;
};
