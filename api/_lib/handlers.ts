import { GoogleGenAI } from "@google/genai";

// Generic Request/Response interface compatible with both Express and Vercel
type Req = {
  body: any;
  query: any;
  method?: string;
};
type Res = {
  status: (code: number) => Res;
  json: (obj: any) => any;
  send: (data: any) => any;
  setHeader: (name: string, value: string) => any;
};

const formatGeminiError = (errorMessage: string): string => {
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
  let url = req.query.url as string;
  if (!url) return res.status(400).send("No URL provided");
  try {
    if (url.includes('tmpfiles.org') && !url.includes('/dl/')) {
      url = url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    return res.send(buffer);
  } catch (e: any) {
    console.error("[api] Proxy error:", e);
    return res.status(500).send(e.message);
  }
}

// ============== /api/proxy-image ==============
export async function handleProxyImage(req: Req, res: Res) {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).json({ error: "No URL provided" });
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(buffer);
  } catch (e: any) {
    console.error("[api] Proxy image error:", e);
    return res.status(500).json({ error: e.message });
  }
}

// ============== Kie.ai helpers ==============
async function runKieImageTask(inputUrls: string[], prompt: string, apiKey: string, aspectRatio: string, imageSize: string) {
  const finalAspectRatio = aspectRatio === '1:1' ? '1:1' : (aspectRatio === '9:16' ? '9:16' : 'auto');
  const requestedSize = (imageSize || '1K').toUpperCase();
  const finalResolution = finalAspectRatio === 'auto'
    ? '1K'
    : (finalAspectRatio === '1:1' && requestedSize === '4K' ? '2K' : requestedSize);

  const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-2-image-to-image',
      input: { prompt, input_urls: inputUrls, aspect_ratio: finalAspectRatio, resolution: finalResolution }
    })
  });
  if (!createRes.ok) throw new Error(`Kie.ai error: ${await createRes.text()}`);
  const createData = await createRes.json();
  if (createData?.code !== 200) throw new Error(createData?.msg || "Lỗi khi gọi Kie.ai (createTask)");
  const taskId = createData?.data?.taskId;
  if (!taskId) throw new Error("Kie.ai không trả về taskId.");

  let maxAttempts = 120;
  while (maxAttempts > 0) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!pollRes.ok) { maxAttempts--; continue; }
    const taskData = await pollRes.json();
    if (taskData?.code !== 200 && taskData?.code !== undefined) throw new Error(taskData?.msg || "Lỗi get task Kie.ai");
    const status = taskData?.data?.status || taskData?.data?.state;
    if (status === 'success' || status === 'COMPLETED' || status === 'done' || status === 'SUCCESS') {
      let outUrl = taskData?.data?.result_url || taskData?.data?.output_uri || taskData?.data?.output_url || taskData?.data?.images?.[0];
      if (!outUrl && taskData?.data?.resultJson) {
        try {
          const rj = JSON.parse(taskData.data.resultJson);
          outUrl = rj.resultUrls?.[0] || rj.images?.[0] || rj.url;
        } catch {}
      }
      return outUrl;
    } else if (status === 'fail' || status === 'failed' || status === 'error' || status === 'FAILED' || status === 'ERROR') {
      throw new Error("Kie task failed: " + (taskData?.data?.failMsg || taskData?.data?.error_message || taskData?.data?.failed_reason || "Lỗi tạo ảnh"));
    }
    if (maxAttempts === 1) throw new Error("Timeout polling Kie.ai task. Mẫu: " + JSON.stringify(taskData));
    maxAttempts--;
  }
  throw new Error("Timeout polling Kie.ai task");
}

async function uploadBase64WithFallback(b64: string, apiKey: string): Promise<string> {
  const buffer = Buffer.from(b64, 'base64');
  const uploadToKieAi = async () => {
    const res = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data: `data:image/jpeg;base64,${b64}`, uploadPath: 'images/base64', fileName: `image-${Date.now()}.jpg` })
    });
    const data: any = await res.json();
    const url = data?.data?.downloadUrl;
    if (!res.ok || !url) throw new Error(`status ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return url;
  };
  const uploadToCatbox = async () => {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
    const text = (await res.text()).trim();
    if (!res.ok || !text.startsWith('https://')) throw new Error(`${res.status} ${text.slice(0, 100)}`);
    return text;
  };
  const uploadToTmpFiles = async () => {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
    const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
    const data: any = await res.json();
    const pageUrl = data?.data?.url;
    if (!pageUrl) throw new Error(`no URL: ${JSON.stringify(data).slice(0, 200)}`);
    return pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/').replace('http://', 'https://');
  };
  const uploadTo0x0 = async () => {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
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
    const { modelId, prompt, imageBase64, templateBase64, aspectRatio, imageSize, numberOfImages, clientKieApiKey, clientGoogleApiKey } = req.body;
    console.log(`[api] /generate modelId=${modelId} numberOfImages=${numberOfImages} imageSize=${imageSize} hasTemplate=${!!templateBase64}`);

    const defaultGoogleKey = process.env.GEMINI_API_KEY;
    const defaultKieKey = process.env.KIE_API_KEY;

    if (modelId === 'gpt-image-2-image-to-image' || modelId === 'kie-ai-gpt2') {
      const apiKey = clientKieApiKey || defaultKieKey;
      if (!apiKey) return res.status(401).json({ error: "Chưa cấu hình API key cho GPT2 (Kie.ai). Vui lòng liên hệ Admin." });

      let inputUrls: string[] = [];
      try {
        if (templateBase64) {
          inputUrls = await Promise.all([
            uploadBase64WithFallback(templateBase64, apiKey),
            uploadBase64WithFallback(imageBase64, apiKey)
          ]);
        } else {
          inputUrls = [await uploadBase64WithFallback(imageBase64, apiKey)];
        }
      } catch (e: any) {
        return res.status(500).json({ error: "Lỗi tải ảnh tĩnh lên máy chủ tạm: " + e.message });
      }

      const count = numberOfImages && typeof numberOfImages === 'number' && numberOfImages > 0 ? numberOfImages : 1;
      try {
        const promises = Array.from({ length: count }).map((_, i) => {
          const variedPrompt = prompt + ' '.repeat(i);
          return runKieImageTask(inputUrls, variedPrompt, apiKey, aspectRatio, imageSize);
        });
        const urls = await Promise.all(promises);
        console.log("[api] Generated urls:", urls);
        return res.json({ imageBase64: urls[0], imagesBase64: urls, isUrl: true });
      } catch (e: any) {
        console.error("[api] Kie.ai parallel error:", e);
        return res.status(500).json({ error: e.message || "Lỗi khi gọi Kie.ai" });
      }
    }

    // Default Gemini processing
    let activeApiKey = defaultGoogleKey;
    let aiOptions: any = {};
    if (modelId === 'gemini-3-pro-image-preview' || modelId === 'gemini-3.1-flash-image-preview') {
      activeApiKey = clientGoogleApiKey || defaultGoogleKey;
      aiOptions = { apiKey: activeApiKey || '' };
    } else {
      aiOptions = { apiKey: defaultGoogleKey || '' };
    }
    if (!activeApiKey) return res.status(500).json({ error: "Chưa cấu hình API key Google. Vui lòng liên hệ Admin." });

    const ai = new GoogleGenAI(aiOptions);
    const count = numberOfImages && typeof numberOfImages === 'number' && numberOfImages > 0 ? numberOfImages : 1;

    const callGeminiOnce = async (variantIdx: number): Promise<string[]> => {
      const variedPrompt = prompt + ' '.repeat(variantIdx);
      const parts: any[] = [];
      if (templateBase64) {
        parts.push({ inlineData: { data: templateBase64, mimeType: "image/jpeg" } });
      }
      parts.push({ inlineData: { data: imageBase64, mimeType: "image/jpeg" } });
      parts.push({ text: variedPrompt });
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "1:1",
            imageSize: imageSize || "1K",
            numberOfImages: 1
          } as any
        }
      });
      const out: string[] = [];
      for (const cand of response.candidates || []) {
        for (const part of cand.content?.parts || []) {
          if (part.inlineData) out.push(part.inlineData.data);
        }
      }
      return out;
    };

    const results = await Promise.all(Array.from({ length: count }).map((_, i) => callGeminiOnce(i)));
    const imagesBase64: string[] = results.flat();
    console.log(`[api] Gemini returned ${imagesBase64.length} image(s) for ${count} requested`);

    if (imagesBase64.length > 0) {
      return res.json({ imageBase64: imagesBase64[0], imagesBase64 });
    }
    return res.status(500).json({ error: "No image generated in response." });
  } catch (error: any) {
    console.error("[api] AI Error:", error);
    return res.status(500).json({ error: formatGeminiError(error.message || "Internal Server Error") });
  }
}

// ============== /api/analyze ==============
export async function handleAnalyze(req: Req, res: Res) {
  try {
    const { imageBase64, mode } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });

    const ai = new GoogleGenAI({ apiKey });
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
    const modelsToTry = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"];
    const maxAttempts = 3;
    let response: any = null;
    let lastError: any = null;

    outer: for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [{ inlineData: { data: imageBase64, mimeType: "image/jpeg" } }, { text: promptText }] },
            config: analyzeMode === 'fashion' ? { responseMimeType: "application/json" } : {}
          });
          console.log(`[api] analyze succeeded with ${modelName} (attempt ${attempt})`);
          break outer;
        } catch (e: any) {
          lastError = e;
          const msg = e?.message || '';
          const isOverload = msg.includes('high demand') || msg.includes('UNAVAILABLE') || msg.includes('overloaded') || msg.includes('503');
          console.warn(`[api] analyze ${modelName} attempt ${attempt} failed: ${msg.slice(0, 120)}`);
          if (!isOverload) throw e;
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 1500));
        }
      }
    }

    if (!response) throw lastError || new Error('Analyze failed after retries');

    const resultText = response.text;
    if (!resultText) {
      console.error("[api] AI returned empty:", JSON.stringify(response));
      return res.status(500).json({ error: "AI response was empty or blocked." });
    }
    return res.json({ result: resultText });
  } catch (error: any) {
    console.error("[api] Analysis Error:", error);
    return res.status(500).json({ error: formatGeminiError(error.message || "Internal Server Error") });
  }
}

// ============== /api/detect-grid ==============
export async function handleDetectGrid(req: Req, res: Res) {
  try {
    const { imageBase64, clientGoogleApiKey } = req.body;
    const apiKey = clientGoogleApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
          { text: "Analyze this image layout, which contains multiple individual sub-images, panels or frames. Identify all the individual sub-images. Output a JSON array of bounding boxes for each sub-image. Each object in the array should have exactly these properties: `ymin`, `xmin`, `ymax`, `xmax`, all as integers between 0 and 1000. Do not include any other properties. Ensure the bounding boxes accurately cover each separate panel." }
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              ymin: { type: "INTEGER" }, xmin: { type: "INTEGER" }, ymax: { type: "INTEGER" }, xmax: { type: "INTEGER" }
            },
            required: ["ymin", "xmin", "ymax", "xmax"]
          }
        }
      } as any
    });

    const resultText = response.text;
    if (!resultText) {
      console.error("[api] Detect Grid empty:", JSON.stringify(response));
      return res.status(500).json({ error: "AI response was empty or blocked." });
    }
    return res.json({ result: resultText });
  } catch (error: any) {
    console.error("[api] Detect Grid Error:", error);
    return res.status(500).json({ error: formatGeminiError(error.message || "Internal Server Error") });
  }
}
