// JobFill BD - Client-Side Image Processor & Canvas Resizer
// Automatically crops, resizes, and compresses uploaded photos to exact 300x300 px (<=100KB)
// and signatures to exact 300x80 px (<=60KB) using local HTML5 Canvas.
// Operates 100% offline.

export interface ImageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageAdvancedOptions {
  targetWidth: number;
  targetHeight: number;
  maxSizeKb: number;
  outputFormat?: 'image/jpeg' | 'image/png';
  cropRect?: ImageCropRect;
  cleanSignatureBackground?: boolean;
  cleanThreshold?: number;
}

export interface ProcessedImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  fileSize: number; // exact bytes
  sizeKb: number;
  format: 'image/jpeg' | 'image/png';
}

export class ImageProcessor {
  /**
   * Decodes a Base64 data URL into raw Uint8Array bytes without logging or external calls
   */
  public static dataUrlToUint8Array(dataUrl: string): Uint8Array {
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Encodes raw bytes into a Base64 data URL
   */
  public static uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(slice));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
  }

  /**
   * Removes greyish photographed paper shadows on a pure-white background while keeping dark signature ink crisp.
   */
  public static cleanSignaturePixels(data: Uint8ClampedArray, threshold = 195): void {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      // Light neutral background paper -> pure white
      if (lum >= threshold && spread < 35) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else if (lum < 130) {
        // Slightly deepen ink strokes for sharper legibility at small dimensions
        data[i] = Math.max(0, Math.round(r * 0.85));
        data[i + 1] = Math.max(0, Math.round(g * 0.85));
        data[i + 2] = Math.max(0, Math.round(b * 0.85));
      }
    }
  }

  /**
   * Crops (optional), optionally cleans signature background, resizes, and binary-search compresses
   * to fit exact dimensions and target KB size without mutating the source image.
   */
  public static async processWithOptions(
    file: File | Blob | string,
    options: ImageAdvancedOptions
  ): Promise<ProcessedImageResult> {
    const {
      targetWidth,
      targetHeight,
      maxSizeKb,
      outputFormat = 'image/jpeg',
      cropRect,
      cleanSignatureBackground = false,
      cleanThreshold = 195,
    } = options;

    const dataUrl = typeof file === 'string' ? file : await this.readAsDataUrl(file);
    const img = await this.loadImage(dataUrl);

    const natW = img.naturalWidth || targetWidth;
    const natH = img.naturalHeight || targetHeight;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    if (outputFormat === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    if (cropRect && cropRect.width > 1 && cropRect.height > 1) {
      const sx = Math.max(0, Math.min(natW - 1, cropRect.x));
      const sy = Math.max(0, Math.min(natH - 1, cropRect.y));
      const sw = Math.max(1, Math.min(natW - sx, cropRect.width));
      const sh = Math.max(1, Math.min(natH - sy, cropRect.height));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    } else {
      const srcRatio = natW / natH;
      const targetRatio = targetWidth / targetHeight;
      let drawWidth = targetWidth;
      let drawHeight = targetHeight;
      let offsetX = 0;
      let offsetY = 0;
      if (srcRatio > targetRatio) {
        drawWidth = targetHeight * srcRatio;
        offsetX = (targetWidth - drawWidth) / 2;
      } else {
        drawHeight = targetWidth / srcRatio;
        offsetY = (targetHeight - drawHeight) / 2;
      }
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }

    if (cleanSignatureBackground && typeof ctx.getImageData === 'function') {
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      this.cleanSignaturePixels(imgData.data, cleanThreshold);
      ctx.putImageData(imgData, 0, 0);
    }

    let outputBlob = await this.canvasToBlob(canvas, outputFormat, 0.92);
    if (outputFormat === 'image/jpeg' && outputBlob.size / 1024 > maxSizeKb) {
      let low = 0.25;
      let high = 0.92;
      let bestBlob = await this.canvasToBlob(canvas, outputFormat, low);
      for (let step = 0; step < 6; step++) {
        const mid = (low + high) / 2;
        const probe = await this.canvasToBlob(canvas, outputFormat, mid);
        if (probe.size / 1024 <= maxSizeKb) {
          bestBlob = probe;
          low = mid;
        } else {
          high = mid;
        }
      }
      outputBlob = bestBlob;
    }

    const finalDataUrl = await this.blobToDataUrl(outputBlob);
    return {
      dataUrl: finalDataUrl,
      blob: outputBlob,
      width: targetWidth,
      height: targetHeight,
      fileSize: outputBlob.size,
      sizeKb: Number((outputBlob.size / 1024).toFixed(2)),
      format: outputFormat,
    };
  }

  /**
   * Resizes and compresses any image into a separate copy fitting exact target dimensions and max KB size.
   * Never mutates the source File or Blob.
   */
  public static async processAndFit(
    file: File | Blob | string,
    targetWidth: number,
    targetHeight: number,
    maxSizeKb: number,
    outputFormat: 'image/jpeg' | 'image/png' = 'image/jpeg'
  ): Promise<ProcessedImageResult> {
    return this.processWithOptions(file, {
      targetWidth,
      targetHeight,
      maxSizeKb,
      outputFormat,
    });
  }

  private static readAsDataUrl(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image data'));
      img.src = src;
    });
  }

  private static canvasToBlob(
    canvas: HTMLCanvasElement,
    format: 'image/jpeg' | 'image/png',
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas conversion to blob failed'));
        },
        format,
        quality
      );
    });
  }

  private static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
