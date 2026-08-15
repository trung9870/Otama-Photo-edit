export const KIE_CREDIT_USD = 0.005;

export type CreditEstimateOptions = {
  modelId: string;
  size?: string;
  count?: number;
  mediaType?: 'image' | 'video';
  duration?: number;
  generateAudio?: boolean;
};

export function creditsPerImage(modelId: string, size?: string): number {
  const normalizedSize = (size || '1k').toLowerCase();
  if (modelId === 'nano-banana-pro' || modelId === 'gemini-3-pro-image-preview') {
    return normalizedSize === '4k' ? 24 : 18;
  }
  if (modelId === 'nano-banana-2' || modelId === 'gemini-3.1-flash-image-preview') {
    return normalizedSize === '4k' ? 18 : normalizedSize === '2k' ? 12 : 8;
  }
  if (modelId === 'gpt-image-2-image-to-image' || modelId === 'kie-ai-gpt2') {
    return normalizedSize === '4k' ? 16 : normalizedSize === '2k' ? 10 : 6;
  }
  if (modelId === 'seedream-4-5-edit' || modelId === 'seedream-4-5-text-to-image') {
    return normalizedSize === '4k' ? 8 : 7;
  }
  return 0;
}

export function creditsPerVideo(
  modelId: string,
  resolution?: string,
  duration?: number,
  generateAudio?: boolean,
): number {
  const seconds = Math.max(4, Math.min(30, Math.round(Number(duration) || 4)));
  const normalizedResolution = (resolution || '720p').toLowerCase();
  if (modelId === 'gemini-omni-video') {
    const creditsPerSecond = normalizedResolution === '4k'
      ? 160
      : normalizedResolution === '1080p' ? 100 : 70;
    return creditsPerSecond * seconds;
  }
  if (modelId === 'bytedance/seedance-2-5') {
    const creditsPerSecond = normalizedResolution === '480p' ? 14 : 22;
    return (creditsPerSecond + (generateAudio ? 2 : 0)) * seconds;
  }
  return 0;
}

export function estimateGenerationCredits(options: CreditEstimateOptions): number {
  if (options.mediaType === 'video') {
    return creditsPerVideo(options.modelId, options.size, options.duration, options.generateAudio);
  }
  return creditsPerImage(options.modelId, options.size) * Math.max(1, Math.round(options.count || 1));
}

export function estimateCreditUsd(credits: number): number {
  return Math.max(0, credits) * KIE_CREDIT_USD;
}
