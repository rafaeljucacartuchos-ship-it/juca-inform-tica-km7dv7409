declare module 'html5-qrcode' {
  export enum Html5QrcodeSupportedFormats {
    QR_CODE = 0,
    AZTEC = 1,
    CODABAR = 2,
    CODE_39 = 3,
    CODE_93 = 4,
    CODE_128 = 5,
    DATA_MATRIX = 6,
    MAXICODE = 7,
    ITF = 8,
    EAN_13 = 9,
    EAN_8 = 10,
    PDF_417 = 11,
    RSS_14 = 12,
    RSS_EXPANDED = 13,
    UPC_A = 14,
    UPC_E = 15,
    UPC_EAN_EXTENSION = 16,
  }

  export interface Html5QrcodeCameraScanConfig {
    fps?: number
    qrbox?: number | { width: number; height: number }
    aspectRatio?: number
    disableFlip?: boolean
    videoConstraints?: MediaTrackConstraints
  }

  export interface Html5QrcodeFullConfig {
    formatsToSupport?: Html5QrcodeSupportedFormats[]
    verbose?: boolean
    experimentalFeatures?: {
      useBarCodeDetectorIfSupported?: boolean
    }
  }

  export interface Html5QrcodeResult {
    decodedText: string
    result: unknown
  }

  export type QrcodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => void
  export type QrcodeErrorCallback = (errorMessage: string, error: unknown) => void

  export class Html5Qrcode {
    constructor(elementId: string, config?: Html5QrcodeFullConfig | boolean)
    start(
      cameraIdOrConfig: string | MediaTrackConstraints,
      configuration: Html5QrcodeCameraScanConfig | undefined,
      qrCodeSuccessCallback: QrcodeSuccessCallback,
      qrCodeErrorCallback?: QrcodeErrorCallback,
    ): Promise<null>
    stop(): Promise<void>
    clear(): void
    isScanning: boolean
    static getCameras(): Promise<Array<{ id: string; label: string }>>
  }
}
