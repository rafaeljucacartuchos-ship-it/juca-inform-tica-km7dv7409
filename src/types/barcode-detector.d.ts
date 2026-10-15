// TypeScript definitions for BarcodeDetector Web API (W3C Community Group / Shape Detection API)
interface DetectedBarcode {
  boundingBox: DOMRectReadOnly
  cornerPoints: Array<{ x: number; y: number }>
  format: string
  rawValue: string
}

interface BarcodeDetectorOptions {
  formats?: string[]
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  static getSupportedFormats(): Promise<string[]>
  detect(
    image: ImageBitmapSource | HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  ): Promise<DetectedBarcode[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
