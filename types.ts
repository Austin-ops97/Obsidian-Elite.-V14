
export enum ToolType {
  DASHBOARD = 'DASHBOARD',
  BG_REMOVER = 'BG_REMOVER',
  UPSCALER = 'UPSCALER',
  VECTOR_CONVERTER = 'VECTOR_CONVERTER'
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  resultUrl: string | null;
  resultType?: 'png' | 'svg'; // Track the format of the current result
}

export interface ImageFile {
  url: string;
  name: string;
  type: string;
  width: number;
  height: number;
}
