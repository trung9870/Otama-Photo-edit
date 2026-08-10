import { openTaskRef, sealTaskRef } from './taskRef.js';

// Generic Request/Response interface compatible with both Express and Vercel
type Req = {
  body: any;
  query: any;
  method?: string;
  auth?: { uid: string };
};
type Res = {
  status: (code: number) => Res;
  json: (obj: any) => any;
  send: (data: any) => any;
  setHeader: (name: string, value: string) => any;
};

const PROXY_MAX_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_PAYLOAD_CHARS = 28 * 1024 * 1024;
const MAX_TOTAL_IMAGE_CHARS = 45 * 1024 * 1024;
const MAX_PROMPT_CHARS = 12_000;
const PROXY_ALLOWED_HOSTS = [
  'tmpfiles.org',
  'catbox.moe',
  '0x0.st',
  'kieai.redpandaai.co',
  'aiquickdraw.com',
  'kie.ai',
  'runninghub.ai',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

function isAllowedProxyHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return PROXY_ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function parseAllowedProxyUrl(rawUrl: string): URL {
  if (typeof rawUrl !== 'string' || rawUrl.length > 4_096) throw new Error('URL không hợp lệ');
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Chỉ hỗ trợ URL HTTPS hợp lệ');
  }
  if (!isAllowedProxyHost(url.hostname)) throw new Error('Nguồn ảnh không được phép');
  return url;
}

async function fetchAllowedMedia(rawUrl: string): Promise<{ data: Buffer; contentType: string }> {
  let url = parseAllowedProxyUrl(rawUrl);
  if (url.hostname === 'tmpfiles.org' && !url.pathname.startsWith('/dl/')) {
    url.pathname = `/dl${url.pathname.startsWith('/') ? '' : '/'}${url.pathname}`;
  }

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'image/*,video/*;q=0.8' },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 3) throw new Error('Quá nhiều lần chuyển hướng');
      url = parseAllowedProxyUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Không tải được file (${response.status})`);
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      throw new Error('URL không trả về ảnh hoặc video');
    }
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > PROXY_MAX_BYTES) throw new Error('File vượt quá giới hạn 25 MB');
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > PROXY_MAX_BYTES) throw new Error('File vượt quá giới hạn 25 MB');
    return { data: Buffer.from(arrayBuffer), contentType };
  }
  throw new Error('Không tải được file');
}

export const formatGeminiError = (errorMessage: string): string => {
  if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
    return "API key Google không hợp lệ. Vui lòng kiểm tra lại.";
  }
  if (errorMessage.includes("high demand") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("overloaded") || errorMessage.includes("503")) {
    return "Google Gemini đang quá tải. Vui lòng đợi 1-2 phút rồi thử lại.";
  }
  if (errorMessage.includes("prepayment credits are depleted") || errorMessage.includes("429")) {
    return "API key Google đã hết tín dụng. Vui lòng nạp thêm hoặc đổi API key khác.";
  }
  if (typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.error && parsed.error.message) return parsed.error.message;
    } catch {}
  }
  return errorMessage;
};

// ============== /api/proxy ==============
export async function handleProxy(req: Req, res: Res) {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("No URL provided");
  try {
    const { data, contentType } = await fetchAllowedMedia(url);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(data);
  } catch (e: any) {
    console.error("[api] Proxy error:", e);
    return res.status(400).send(e.message);
  }
}

// ============== /api/proxy-image ==============
export async function handleProxyImage(req: Req, res: Res) {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).json({ error: "No URL provided" });
    const { data, contentType } = await fetchAllowedMedia(imageUrl);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(data);
  } catch (e: any) {
    console.error("[api] Proxy image error:", e);
    return res.status(400).json({ error: e.message });
  }
}

// ============== Kie.ai helpers ==============
export const KIE_MODELS = ['gpt-image-2-image-to-image', 'kie-ai-gpt2', 'nano-banana-pro', 'nano-banana-2', 'seedream-4-5-edit', 'seedream-4-5-text-to-image'];

// Create a task and return the taskId immediately (no polling).
// Supports both GPT Image 2 (input_urls + constrained aspect/resolution) and
// Google Nano Banana Pro / 2 (image_input + full aspect/resolution support).
export async function createKieImageTask(model: string, inputUrls: string[], prompt: string, apiKey: string, aspectRatio: string, imageSize: string): Promise<string> {
  // gpt-image-2-image-to-image requires input_urls; if caller wants T2I (empty inputUrls),
  // swap to the sibling alias gpt-image-2-text-to-image which accepts prompt only.
  let kieModel = model === 'kie-ai-gpt2' ? 'gpt-image-2-image-to-image' : model;
  const isT2I = !inputUrls || inputUrls.length === 0;
  if (isT2I && kieModel === 'gpt-image-2-image-to-image') {
    kieModel = 'gpt-image-2-text-to-image';
  }
  // Seedream 4.5 — internal kebab-case ids map to the slash-form Kie aliases.
  // T2I and I2I are SEPARATE aliases (unlike Banana). image_urls field name (NOT image_input).
  const isSeedreamEditInternal = kieModel === 'seedream-4-5-edit';
  const isSeedreamT2IInternal = kieModel === 'seedream-4-5-text-to-image';
  if (isSeedreamEditInternal || isSeedreamT2IInternal) {
    kieModel = isT2I || isSeedreamT2IInternal ? 'seedream/4.5-text-to-image' : 'seedream/4.5-edit';
  }
  const isGpt2I2I = kieModel === 'gpt-image-2-image-to-image';
  const isGpt2T2I = kieModel === 'gpt-image-2-text-to-image';
  const isSeedream = kieModel === 'seedream/4.5-edit' || kieModel === 'seedream/4.5-text-to-image';
  const isSeedreamI2I = kieModel === 'seedream/4.5-edit';

  let input: any;
  if (isSeedream) {
    // Seedream 4.5 — required: prompt, aspect_ratio, quality. NO output_format / image_size / n.
    // Aspect ratios supported: 1:1, 4:3, 3:4, 16:9, 9:16, 2:3, 3:2, 21:9. NO 'auto'.
    const SUPPORTED_AR = ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '21:9'];
    const finalAspectRatio = SUPPORTED_AR.includes(aspectRatio) ? aspectRatio : '1:1';
    // quality enum: 'basic' (2K) | 'high' (4K). Map UI size 4K → high; everything else → basic.
    const quality = (imageSize || '1k').toLowerCase() === '4k' ? 'high' : 'basic';
    input = {
      prompt,
      aspect_ratio: finalAspectRatio,
      quality,
      nsfw_checker: false,
    };
    if (isSeedreamI2I) {
      // image_urls — snake_case PLURAL (NOT image_input, NOT input_urls). Docs cap = 14; stay under at 10.
      input.image_urls = (inputUrls || []).slice(0, 10);
    }
  } else if (isGpt2I2I || isGpt2T2I) {
    // GPT Image 2 ratios from Kie.ai OpenAPI. auto is 1K-only; 5:4/4:5 are
    // 1K-only; 1:1 supports up to 2K.
    const SUPPORTED = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '3:1', '1:3', '21:9', '9:21'];
    const finalAspectRatio = SUPPORTED.includes(aspectRatio) ? aspectRatio : 'auto';
    const requestedSize = (imageSize || '1K').toUpperCase();
    const finalResolution = finalAspectRatio === 'auto' || finalAspectRatio === '5:4' || finalAspectRatio === '4:5'
      ? '1K'
      : (finalAspectRatio === '1:1' && requestedSize === '4K' ? '2K' : requestedSize);
    // T2I alias has no input_urls field
    input = isGpt2T2I
      ? { prompt, aspect_ratio: finalAspectRatio, resolution: finalResolution }
      : { prompt, input_urls: inputUrls, aspect_ratio: finalAspectRatio, resolution: finalResolution };
  } else {
    // Nano Banana Pro / 2: dùng image_input. T2I = omit image_input field entirely.
    // Be conservative on T2I — only send the documented fields. output_format is documented
    // for i2i; if Kie ever tightens validation on the T2I path, dropping it here keeps us safe.
    const base: any = {
      prompt,
      aspect_ratio: aspectRatio || 'auto',
      resolution: (imageSize || '1K').toUpperCase(),
    };
    if (!isT2I) {
      base.image_input = inputUrls;
      base.output_format = 'png';
    }
    input = base;
  }

  const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: kieModel, input })
  });
  if (!createRes.ok) throw new Error(`Kie.ai error: ${await createRes.text()}`);
  const createData = await createRes.json();
  if (createData?.code !== 200) throw new Error(createData?.msg || "Lỗi khi gọi Kie.ai (createTask)");
  const taskId = createData?.data?.taskId;
  if (!taskId) throw new Error("Kie.ai không trả về taskId.");
  return taskId;
}

// Single poll iteration — returns the current status without waiting.
async function pollKieTaskOnce(taskId: string, apiKey: string): Promise<{ status: 'pending' | 'success' | 'failed'; url?: string; error?: string }> {
  const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!pollRes.ok) return { status: 'pending' };
  const taskData: any = await pollRes.json();
  if (taskData?.code !== 200 && taskData?.code !== undefined) {
    return { status: 'failed', error: taskData?.msg || "Lỗi get task Kie.ai" };
  }
  const status = taskData?.data?.status || taskData?.data?.state;
  if (status === 'success' || status === 'COMPLETED' || status === 'done' || status === 'SUCCESS') {
    let outUrl = taskData?.data?.result_url || taskData?.data?.output_uri || taskData?.data?.output_url || taskData?.data?.images?.[0];
    if (!outUrl && taskData?.data?.resultJson) {
      try {
        const rj = JSON.parse(taskData.data.resultJson);
        outUrl = rj.resultUrls?.[0] || rj.images?.[0] || rj.url;
      } catch {}
    }
    return { status: 'success', url: outUrl };
  }
  if (status === 'fail' || status === 'failed' || status === 'error' || status === 'FAILED' || status === 'ERROR') {
    const errMsg = taskData?.data?.failMsg || taskData?.data?.error_message || taskData?.data?.failed_reason || "Lỗi tạo ảnh";
    return { status: 'failed', error: "Kie task failed: " + errMsg };
  }
  return { status: 'pending' };
}

type ParsedImagePayload = {
  buffer: Buffer;
  dataUrl: string;
  mimeType: string;
  extension: string;
};

function parseImagePayload(payload: string): ParsedImagePayload {
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > MAX_IMAGE_PAYLOAD_CHARS) {
    throw new Error('Ảnh không hợp lệ hoặc vượt quá giới hạn 20 MB');
  }
  const dataUrlMatch = payload.match(/^data:([^;,]+);base64,(.+)$/s);
  const rawBase64 = dataUrlMatch ? dataUrlMatch[2] : payload;
  const buffer = Buffer.from(rawBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh không hợp lệ hoặc vượt quá giới hạn 20 MB');
  }
  let mimeType = dataUrlMatch?.[1]?.toLowerCase() || '';

  // Legacy callers sent raw base64 and the old code mislabeled every file as
  // JPEG. Detect the true format so Kie receives the original bytes and MIME.
  if (!mimeType) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      mimeType = 'image/png';
    } else if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      mimeType = 'image/jpeg';
    } else if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      mimeType = 'image/webp';
    } else {
      mimeType = 'application/octet-stream';
    }
  }

  const extension = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/jpeg'
        ? 'jpg'
        : 'bin';

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    throw new Error('Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP');
  }

  return {
    buffer,
    dataUrl: `data:${mimeType};base64,${rawBase64}`,
    mimeType,
    extension,
  };
}

function isRemoteImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function uploadBase64WithFallback(payload: string, apiKey: string): Promise<string> {
  if (isRemoteImageUrl(payload)) return parseAllowedProxyUrl(payload).toString();

  const { buffer, dataUrl, mimeType, extension } = parseImagePayload(payload);
  const uniqueName = `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const uploadToKieAi = async () => {
    const res = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: dataUrl, uploadPath: 'images/base64', fileName: uniqueName })
    });
    const data: any = await res.json();
    const url = data?.data?.downloadUrl;
    if (!res.ok || !url) throw new Error(`status ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return url;
  };
  const uploadToCatbox = async () => {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', new Blob([buffer], { type: mimeType }), uniqueName);
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
    const text = (await res.text()).trim();
    if (!res.ok || !text.startsWith('https://')) throw new Error(`${res.status} ${text.slice(0, 100)}`);
    return text;
  };
  const uploadToTmpFiles = async () => {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), uniqueName);
    const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
    const data: any = await res.json();
    const pageUrl = data?.data?.url;
    if (!pageUrl) throw new Error(`no URL: ${JSON.stringify(data).slice(0, 200)}`);
    return pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/').replace('http://', 'https://');
  };
  const uploadTo0x0 = async () => {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), uniqueName);
    const res = await fetch('https://0x0.st', { method: 'POST', body: formData });
    const text = (await res.text()).trim();
    if (!res.ok || !text.startsWith('https://')) throw new Error(`${res.status} ${text.slice(0, 100)}`);
    return text;
  };

  const hosts = [
    { name: 'kie.ai', fn: uploadToKieAi },
    { name: 'catbox.moe', fn: uploadToCatbox },
    { name: 'tmpfiles.org', fn: uploadToTmpFiles },
    { name: '0x0.st', fn: uploadTo0x0 },
  ];
  const errors: string[] = [];
  for (const host of hosts) {
    try {
      const url = await host.fn();
      console.log(`[upload] Success via ${host.name}: ${url}`);
      return url;
    } catch (err: any) {
      console.warn(`[upload] ${host.name} failed: ${err.message}`);
      errors.push(`${host.name}: ${err.message}`);
    }
  }
  throw new Error(`Tất cả host ảnh tạm đều fail. ${errors.join(' | ')}`);
}

// ============== /api/generate ==============
export async function handleGenerate(req: Req, res: Res) {
  try {
    const { modelId, prompt, referenceMode, referenceImages, imageBase64, templateBase64, composeImages, aspectRatio, imageSize, numberOfImages, t2iMode } = req.body;
    const explicitReferences: string[] = Array.isArray(referenceImages)
      ? referenceImages.filter((value: any) => typeof value === 'string' && value.length > 0)
      : [];
    const composeList: string[] = Array.isArray(composeImages) ? composeImages.filter((b: any) => typeof b === 'string' && b.length > 0) : [];
    // T2I = client explicitly opted in via flag. Don't fall back when imageBase64 happens to be missing —
    // that masks real upload failures behind a silently-T2I path. Old clients without the flag stay i2i.
    const isT2I = !!t2iMode;
    if (!req.auth?.uid) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    console.log(`[api] /generate modelId=${modelId} numberOfImages=${numberOfImages} imageSize=${imageSize} hasTemplate=${!!templateBase64} composeCount=${composeList.length} t2i=${isT2I}`);

    if (typeof prompt !== 'string' || prompt.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({ error: `Prompt phải là chuỗi và không vượt quá ${MAX_PROMPT_CHARS.toLocaleString()} ký tự.` });
    }
    if (explicitReferences.length > 8 || composeList.length > 8) {
      return res.status(400).json({ error: 'Mỗi lần gen chỉ hỗ trợ tối đa 8 ảnh tham chiếu.' });
    }
    const allImageSources = [...explicitReferences, ...composeList, imageBase64, templateBase64]
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    if (allImageSources.some((value) => value.length > MAX_IMAGE_PAYLOAD_CHARS) ||
        allImageSources.reduce((sum, value) => sum + value.length, 0) > MAX_TOTAL_IMAGE_CHARS) {
      return res.status(413).json({ error: 'Tổng dung lượng ảnh tải lên quá lớn.' });
    }
    const count = Number(numberOfImages ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 8) {
      return res.status(400).json({ error: 'Số ảnh mỗi lần gen phải từ 1 đến 8.' });
    }
    if (isT2I && !prompt.trim()) {
      return res.status(400).json({ error: "Chế độ Text-to-Image cần prompt mô tả ảnh muốn tạo." });
    }
    if (!isT2I && explicitReferences.length === 0 && !imageBase64 && composeList.length === 0 && !templateBase64) {
      return res.status(400).json({ error: "Thiếu ảnh sản phẩm. Bật chế độ Text-to-Image nếu muốn gen từ prompt thuần." });
    }

    const defaultKieKey = process.env.KIE_API_KEY;

    if (!KIE_MODELS.includes(modelId)) {
      return res.status(400).json({ error: `Model "${modelId}" không được hỗ trợ. Ứng dụng này chỉ gọi model qua Kie.ai.` });
    }

    if (KIE_MODELS.includes(modelId)) {
      const apiKey = defaultKieKey;
      if (!apiKey) return res.status(401).json({ error: "Chưa cấu hình API key Kie.ai. Vui lòng liên hệ Admin." });

      let inputUrls: string[] = [];
      try {
        if (isT2I) {
          // Text-to-image: no images uploaded; createKieImageTask will branch on empty inputUrls
          inputUrls = [];
        } else if (explicitReferences.length > 0) {
          // Canonical order: Product Reference first, Composition Reference second.
          inputUrls = await Promise.all(explicitReferences.map((source) => uploadBase64WithFallback(source, apiKey)));
        } else if (composeList.length > 0) {
          inputUrls = await Promise.all(composeList.map((source) => uploadBase64WithFallback(source, apiKey)));
        } else if (templateBase64) {
          // Preserve the new canonical order for legacy two-image clients too.
          inputUrls = await Promise.all([
            uploadBase64WithFallback(imageBase64, apiKey),
            uploadBase64WithFallback(templateBase64, apiKey)
          ]);
        } else {
          inputUrls = [await uploadBase64WithFallback(imageBase64, apiKey)];
        }
      } catch (e: any) {
        return res.status(500).json({ error: "Lỗi tải ảnh tĩnh lên máy chủ tạm: " + e.message });
      }

      const finalPrompt = referenceMode === 'product-composition' && inputUrls.length >= 2
        ? `Reference Image 1 = Product Reference. Preserve its identity, material, colors, texture, logos, and fine details.\nReference Image 2 = Composition Reference. Use it only for layout, pose, camera, lighting, and scene structure.\n\n${prompt}`
        : prompt;
      try {
        // Create N tasks in parallel, return taskIds immediately.
        // Client will poll /api/generate-check to track each task's completion.
        const taskIds = await Promise.all(
          Array.from({ length: count }).map(() =>
            createKieImageTask(modelId, inputUrls, finalPrompt, apiKey, aspectRatio, imageSize)
          )
        );
        console.log("[api] Created Kie tasks:", taskIds.length);
        return res.json({ taskIds: taskIds.map((taskId) => sealTaskRef('kie', taskId, req.auth!.uid)), isAsync: true });
      } catch (e: any) {
        console.error("[api] Kie.ai createTask error:", e);
        return res.status(500).json({ error: e.message || "Lỗi khi gọi Kie.ai" });
      }
    }

  } catch (error: any) {
    console.error("[api] AI Error:", error);
    return res.status(500).json({ error: formatGeminiError(error.message || "Internal Server Error") });
  }
}

// ============== /api/generate-check ==============
// Polls a single Kie.ai task once and returns its current status.
// Client calls this every few seconds until status is 'success' or 'failed'.
export async function handleGenerateCheck(req: Req, res: Res) {
  try {
    const taskReference = (req.query?.taskId as string) || req.body?.taskId;
    if (!req.auth?.uid) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    if (!taskReference || typeof taskReference !== 'string' || taskReference.length > 2_048) return res.status(400).json({ error: "Missing or invalid taskId" });
    let taskId: string;
    try {
      taskId = openTaskRef(taskReference, 'kie', req.auth.uid);
    } catch (error: any) {
      return res.status(403).json({ error: error?.message || 'Task không thuộc tài khoản hiện tại.' });
    }
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(401).json({ error: "Chưa cấu hình API key cho GPT2 (Kie.ai). Vui lòng liên hệ Admin." });
    const result = await pollKieTaskOnce(taskId, apiKey);
    return res.json(result);
  } catch (error: any) {
    console.error("[api] Generate-check error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}

// ============== Kie.ai chat completions helper (Gemini 3.5 Flash) ==============
// Wraps Kie's OpenAI-compatible endpoint so analyze/detect-grid can share it.
// Bill goes to Kie balance instead of direct Google — cheaper + single quota.
async function geminiChatViaKie(opts: {
  imageBase64: string;
  prompt: string;
  kieApiKey: string;
  jsonMode?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const imageUrl = await uploadBase64WithFallback(opts.imageBase64, opts.kieApiKey);
  const endpoint = 'https://api.kie.ai/gemini-3-5-flash-openai/v1/chat/completions';
  const body: any = {
    model: 'gemini-3-5-flash',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: opts.prompt },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }],
    stream: false,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.kieApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Kie chat completions HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  const modelUsed: string = data?.model || 'gemini-3-5-flash';
  if (!text) throw new Error('Kie trả về nội dung rỗng.');
  return { text, modelUsed };
}

// ============== /api/analyze ==============
// Migrated: Gemini direct → Kie.ai (Gemini 3.5 Flash OpenAI-compat) để tiết kiệm cost
// và tránh sạc GEMINI_API_KEY quota. Fashion mode = JSON; bedding = free text (Chinese format).
export async function handleAnalyze(req: Req, res: Res) {
  try {
    const { imageBase64, mode } = req.body;
    const kieApiKey = process.env.KIE_API_KEY;
    if (!kieApiKey) return res.status(500).json({ error: "KIE_API_KEY chưa cấu hình trên server." });
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0 || imageBase64.length > MAX_IMAGE_PAYLOAD_CHARS) {
      return res.status(413).json({ error: 'Ảnh phân tích không hợp lệ hoặc vượt quá 20 MB.' });
    }

    const analyzeMode: 'fashion' | 'bedding' = mode === 'bedding' ? 'bedding' : 'fashion';

    const FASHION_PROMPT = "Analyze this image and generate a detailed prompt for recreating a similar product photo. Focus on: styling, angle, lighting, background, props, and technical details. IMPORTANT: Do not describe the specific product shown in the image (e.g., don't say 'denim shorts'). Instead, use a generic placeholder like 'the product' or 'main subject' so this prompt can be reused for any item. Output ONLY the JSON object.";

    const BEDDING_PROMPT = `Bạn là copywriter chuyên ngành chăn ga gối Việt Nam, 10 năm kinh nghiệm
viết content Shopee/TikTok Shop. Brand: ngọt ngào, gần gũi, hướng đến
phụ nữ 22-40 tuổi.

[Phân tích ảnh sản phẩm đính kèm]

NHIỆM VỤ:
Tạo 8 cặp HEADLINE + BODY tiếng Việt cho trang chi tiết sản phẩm.
Mỗi cặp tương ứng 1 ảnh, mỗi ảnh 1 selling point.

ĐIỂM MẠNH ĐÃ CÓ SẴN (có thể để trống):
{
  -
  -
  -
}
→ Nếu có, đưa các điểm này vào 8 cặp đầu tiên, viết rõ và sâu hơn.
→ Còn thiếu thì tự đề xuất từ phân tích ảnh.

YÊU CẦU MỖI CẶP:
- HEADLINE: 3-5 từ IN HOA, mạnh, dễ nhớ.
  Ví dụ tốt: "ÔM TRỌN AN TÂM", "MỀM NHƯ MÂY", "MÁT CẢ ĐÊM HÈ"
  Ví dụ tệ: "SẢN PHẨM CHẤT LƯỢNG CAO", "TỐI ƯU HOÁ TRẢI NGHIỆM"

- BODY: tối đa 12 từ, văn nói tự nhiên, đúng cách người Việt nói.
  Ví dụ tốt: "Cotton chải mịn — da nhạy cảm vẫn dùng yên tâm"
  Ví dụ tệ: "Sản phẩm được sản xuất từ chất liệu cao cấp đảm bảo"

- KHÔNG dùng Hán-Việt cứng: "hoạt tính", "tăng cường", "tối ưu", "đảm bảo"
- KHÔNG dịch word-by-word từ tiếng Trung
- DÙNG cảm xúc thật: ngọt, mềm, êm, ôm, mát, ấm, nhẹ nhàng

8 GÓC NHÌN ĐA DẠNG (chọn 8, không lặp ý):
1. Cảm giác khi dùng (mềm, mát, êm, ôm)
2. Chất liệu vải / ruột bông
3. Kích thước — phù hợp ai (người cao, gia đình, bé)
4. Công năng đa dụng (nếu có)
5. Độ bền — giặt nhiều lần vẫn đẹp
6. Công nghệ in / dệt / nhuộm
7. Chi tiết tinh tế (đường may, khoá kéo, viền, nhãn)
8. Giá trị cảm xúc (quà tặng, decor phòng, không gian)

ĐẦU RA — CHÍNH XÁC FORMAT NÀY, KHÔNG THÊM GÌ:

图 1: HEADLINE "..." / BODY "..."
图 2: HEADLINE "..." / BODY "..."
图 3: HEADLINE "..." / BODY "..."
图 4: HEADLINE "..." / BODY "..."
图 5: HEADLINE "..." / BODY "..."
图 6: HEADLINE "..." / BODY "..."
图 7: HEADLINE "..." / BODY "..."
图 8: HEADLINE "..." / BODY "..."`;

    const promptText = analyzeMode === 'bedding' ? BEDDING_PROMPT : FASHION_PROMPT;
    const maxAttempts = 3;
    let text = '';
    let modelUsed = '';
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const out = await geminiChatViaKie({
          imageBase64,
          prompt: promptText,
          kieApiKey,
          jsonMode: analyzeMode === 'fashion',
        });
        text = out.text;
        modelUsed = out.modelUsed;
        console.log(`[api] analyze via Kie succeeded (attempt ${attempt}, model ${modelUsed})`);
        break;
      } catch (e: any) {
        lastError = e;
        const msg = e?.message || '';
        const isOverload = msg.includes('503') || msg.includes('502') || msg.includes('overloaded') || msg.includes('UNAVAILABLE');
        console.warn(`[api] analyze via Kie attempt ${attempt} failed: ${msg.slice(0, 160)}`);
        if (!isOverload) throw e;
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }

    if (!text) throw lastError || new Error('Analyze failed after retries');
    return res.json({ result: text });
  } catch (error: any) {
    console.error("[api] Analysis Error:", error);
    return res.status(500).json({ error: formatGeminiError(error.message || "Internal Server Error") });
  }
}

// ============== /api/detect-grid ==============
// Migrated: Gemini direct → Kie.ai (Gemini 3.5 Flash OpenAI-compat).
// Kie response_format=json_object trả object, không phải array — prompt yêu cầu wrap trong { "boxes": [...] } rồi unwrap về array cho client.
export async function handleDetectGrid(req: Req, res: Res) {
  try {
    const { imageBase64 } = req.body;
    const kieApiKey = process.env.KIE_API_KEY;
    if (!kieApiKey) return res.status(500).json({ error: "KIE_API_KEY chưa cấu hình trên server." });
    if (typeof imageBase64 !== 'string' || imageBase64.length === 0 || imageBase64.length > MAX_IMAGE_PAYLOAD_CHARS) {
      return res.status(413).json({ error: 'Ảnh phân tích không hợp lệ hoặc vượt quá 20 MB.' });
    }

    const prompt = 'Analyze this image layout, which contains multiple individual sub-images, panels or frames. Identify all the individual sub-images. Output a JSON object with a single key "boxes" whose value is an array of bounding boxes. Each object in the array must have exactly these properties: ymin, xmin, ymax, xmax — all integers between 0 and 1000. Do not include any other keys or commentary. Ensure the boxes accurately cover each separate panel. Example output: {"boxes":[{"ymin":0,"xmin":0,"ymax":500,"xmax":500}]}';

    const { text } = await geminiChatViaKie({
      imageBase64,
      prompt,
      kieApiKey,
      jsonMode: true,
    });

    // Kie returns a JSON object; extract .boxes and return it as a JSON string so
    // the client (which parses result as an array) keeps its existing shape.
    let boxesJson = text;
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.boxes) ? parsed.boxes : null);
      if (arr) boxesJson = JSON.stringify(arr);
    } catch {
      // If parsing fails, pass through raw text — client has its own cleanup path.
    }
    return res.json({ result: boxesJson });
  } catch (error: any) {
    console.error("[api] Detect Grid Error:", error);
    return res.status(500).json({ error: formatGeminiError(error.message || "Internal Server Error") });
  }
}

// ============== /api/kie-credits ==============
// Trả về số credit còn lại trong tài khoản Kie.ai (dùng key server, không lộ ra client).
export async function handleKieCredits(req: Req, res: Res) {
  try {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) return res.status(401).json({ error: "Chưa cấu hình Kie API key." });
    const r = await fetch('https://api.kie.ai/api/v1/chat/credit', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!r.ok) return res.status(502).json({ error: `Kie.ai trả về ${r.status}` });
    const data: any = await r.json();
    // Chuẩn hoá: số credit có thể nằm ở data.data (number) hoặc data.data.credits
    let credits: number | null = null;
    if (typeof data?.data === 'number') credits = data.data;
    else if (typeof data?.data?.credits === 'number') credits = data.data.credits;
    else if (typeof data?.credits === 'number') credits = data.credits;
    return res.json({ credits, raw: data?.data ?? data });
  } catch (e: any) {
    console.error("[api] Kie credits error:", e);
    return res.status(500).json({ error: e.message || "Lỗi lấy số dư Kie.ai" });
  }
}
