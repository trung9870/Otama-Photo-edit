import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.get("/api/proxy", async (req, res) => {
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
      res.send(buffer);
    } catch (e: any) {
      console.error("[server] Proxy error:", e);
      res.status(500).send(e.message);
    }
  });

  // API endpoint for AI generation (using owner's key)
  app.post("/api/generate", async (req, res) => {
    try {
      const { modelId, prompt, imageBase64, templateBase64, aspectRatio, imageSize, numberOfImages, clientKieApiKey, clientGoogleApiKey } = req.body;
      console.log(`[server] /api/generate called with modelId=${modelId}, numberOfImages=${numberOfImages}, prompt=${prompt}, imageSize=${imageSize}, hasTemplate=${!!templateBase64}`);
      
      const defaultApiKey = process.env.GEMINI_API_KEY;

      const runKieImageTask = async (inputUrls: string[], prompt: string, apiKey: string, aspectRatio: string, imageSize: string) => {
        const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-image-2-image-to-image',
            input: {
              prompt: prompt,
              input_urls: inputUrls,
              aspect_ratio: aspectRatio === '1:1' ? '1:1' : (aspectRatio === '9:16' ? '9:16' : 'auto'),
              resolution: (aspectRatio === '1:1' && (imageSize || '1K').toUpperCase() === '4K') ? '2K' : (aspectRatio === 'auto' ? '1K' : (imageSize || '1K').toUpperCase())
            }
          })
        });
        
        if (!createRes.ok) {
           const errText = await createRes.text();
           throw new Error(`Kie.ai error: ${errText}`);
        }
        
        const createData = await createRes.json();
        
        if (createData?.code !== 200) {
           throw new Error(createData?.msg || "Lỗi khi gọi Kie.ai (createTask)");
        }

        const taskId = createData?.data?.taskId;
        if (!taskId) {
           throw new Error("Kie.ai không trả về taskId.");
        }

        let maxAttempts = 120; // 120 attempts, 3s each = 360s
        while (maxAttempts > 0) {
          await new Promise(r => setTimeout(r, 3000));
          
          // Using GET /api/v1/jobs/recordInfo as task details
          const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          
          if (!pollRes.ok) {
            maxAttempts--;
            continue;
          }
          
          const taskData = await pollRes.json();
          // Often status is "success", "completed", "done", but we also check if code is 200
          if (taskData?.code !== 200 && taskData?.code !== undefined) {
             throw new Error(taskData?.msg || "Lỗi get task Kie.ai");
          }

          const status = taskData?.data?.status || taskData?.data?.state;
          if (status === 'success' || status === 'COMPLETED' || status === 'done' || status === 'SUCCESS') {
            let outUrl = taskData?.data?.result_url || taskData?.data?.output_uri || taskData?.data?.output_url || taskData?.data?.images?.[0];
            if (!outUrl && taskData?.data?.resultJson) {
               try {
                 const rj = JSON.parse(taskData.data.resultJson);
                 outUrl = rj.resultUrls?.[0] || rj.images?.[0] || rj.url;
               } catch(e) {}
            }
            return outUrl;
          } else if (status === 'fail' || status === 'failed' || status === 'error' || status === 'FAILED' || status === 'ERROR') {
            throw new Error("Kie task failed: " + (taskData?.data?.failMsg || taskData?.data?.error_message || taskData?.data?.failed_reason || "Lỗi tạo ảnh"));
          }
          
          if (maxAttempts === 1) { // if this is the last attempt
            throw new Error("Timeout polling Kie.ai task. Mẫu dữ liệu task: " + JSON.stringify(taskData));
          }
          maxAttempts--;
        }
        throw new Error("Timeout polling Kie.ai task");
      };

      if (modelId === 'gpt-image-2-image-to-image' || modelId === 'kie-ai-gpt2') {
        const apiKey = clientKieApiKey || defaultApiKey;
        if (!apiKey) {
           return res.status(401).json({ error: "Missing Kie.ai API key" });
        }
        
        let inputUrls: string[] = [];
        try {
          // Try KIE.AI's own File Upload API first (most reliable for KIE.AI tasks),
          // then fall back to third-party temp hosts if KIE upload fails.
          const uploadBase64WithFallback = async (b64: string): Promise<string> => {
            const buffer = Buffer.from(b64, 'base64');

            const uploadToKieAi = async (): Promise<string> => {
              const res = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  base64Data: `data:image/jpeg;base64,${b64}`,
                  uploadPath: 'images/base64',
                  fileName: `image-${Date.now()}.jpg`
                })
              });
              const data: any = await res.json();
              const url = data?.data?.downloadUrl;
              if (!res.ok || !url) {
                throw new Error(`status ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
              }
              return url;
            };

            const uploadToCatbox = async (): Promise<string> => {
              const formData = new FormData();
              formData.append('reqtype', 'fileupload');
              formData.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
              const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
              const text = (await res.text()).trim();
              if (!res.ok || !text.startsWith('https://')) {
                throw new Error(`${res.status} ${text.slice(0, 100)}`);
              }
              return text;
            };

            const uploadToTmpFiles = async (): Promise<string> => {
              const formData = new FormData();
              formData.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
              const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
              const data: any = await res.json();
              const pageUrl = data?.data?.url;
              if (!pageUrl) throw new Error(`no URL: ${JSON.stringify(data).slice(0, 200)}`);
              return pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/').replace('http://', 'https://');
            };

            const uploadTo0x0 = async (): Promise<string> => {
              const formData = new FormData();
              formData.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
              const res = await fetch('https://0x0.st', { method: 'POST', body: formData });
              const text = (await res.text()).trim();
              if (!res.ok || !text.startsWith('https://')) {
                throw new Error(`${res.status} ${text.slice(0, 100)}`);
              }
              return text;
            };

            const hosts: Array<{ name: string; fn: () => Promise<string> }> = [
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
          };

          if (templateBase64) {
            // Upload both parallelly. Prompt rule: Template is Image 1, Product is Image 2.
            inputUrls = await Promise.all([
              uploadBase64WithFallback(templateBase64),
              uploadBase64WithFallback(imageBase64)
            ]);
          } else {
            inputUrls = [await uploadBase64WithFallback(imageBase64)];
          }
        } catch (e: any) {
           return res.status(500).json({ error: "Lỗi tải ảnh tĩnh lên máy chủ tạm: " + e.message });
        }

        const count = numberOfImages && typeof numberOfImages === 'number' && numberOfImages > 0 ? numberOfImages : 1;
        
        try {
          const promises = Array.from({ length: count }).map((_, i) => {
            // Append an invisible space or something to force cache miss / variation
            const variedPrompt = prompt + ' '.repeat(i);
            return runKieImageTask(inputUrls, variedPrompt, apiKey, aspectRatio, imageSize);
          });
          const urls = await Promise.all(promises);
          console.log("[server] Generated urls:", urls);
          return res.json({ imageBase64: urls[0], imagesBase64: urls, isUrl: true });
        } catch (e: any) {
          console.error("[server] Kie.ai parallel error:", e);
          return res.status(500).json({ error: e.message || "Lỗi khi gọi Kie.ai" });
        }
      }

      // Default Gemini processing
      let activeApiKey = defaultApiKey;
      let aiOptions: any = {};
      
      if (modelId === 'gemini-3-pro-image-preview') {
        activeApiKey = clientGoogleApiKey || defaultApiKey;
        aiOptions = { apiKey: activeApiKey || '' };
      } else if (modelId === 'gemini-3.1-flash-image-preview') {
        activeApiKey = clientGoogleApiKey || defaultApiKey;
        aiOptions = { apiKey: activeApiKey || '' };
      } else {
        // Fallback for other models if any
        aiOptions = { apiKey: defaultApiKey || '' };
      }

      if (!activeApiKey) {
        return res.status(500).json({ error: "Missing required API Key for this model." });
      }

      const ai = new GoogleGenAI(aiOptions);

      const response = await ai.models.generateContent({
        model: modelId,
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg",
              },
            },
            { text: prompt },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "1:1",
            imageSize: imageSize || "1K",
            numberOfImages: numberOfImages || 1
          } as any
        }
      });

      // Extract images from response
      const candidates = response.candidates;
      const imagesBase64: string[] = [];
      
      if (candidates && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            imagesBase64.push(part.inlineData.data);
          }
        }
      }

      if (imagesBase64.length > 0) {
        return res.json({ 
          imageBase64: imagesBase64[0], // Keep backward compatibility for single image
          imagesBase64 
        });
      }

      res.status(500).json({ error: "No image generated in response." });
    } catch (error: any) {
      console.error("Server AI Error:", error);
      let errorMessage = error.message || "Internal Server Error";
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        errorMessage = "API key Google không hợp lệ. Vui lòng kiểm tra lại.";
      } else if (errorMessage.includes("prepayment credits are depleted") || errorMessage.includes("429")) {
        errorMessage = "API key Google đã hết tín dụng. Vui lòng nạp thêm hoặc đổi API key khác.";
      } else if (typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          }
        } catch(e){}
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // API endpoint for AI analysis (using owner's key)
  app.post("/api/analyze", async (req, res) => {
    try {
      const { imageBase64, mode } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

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

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg",
              },
            },
            { text: promptText }
          ],
        },
        config: analyzeMode === 'fashion' ? { responseMimeType: "application/json" } : {}
      });

      const resultText = response.text;
      if (!resultText) {
          console.error("AI returned empty response:", JSON.stringify(response));
          return res.status(500).json({ error: "AI response was empty or blocked." });
      }

      res.json({ result: resultText });
    } catch (error: any) {
      console.error("Server Analysis Error:", error);
      let errorMessage = error.message || "Internal Server Error";
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        errorMessage = "API key không hợp lệ. Vui lòng kiểm tra lại.";
      } else if (errorMessage.includes("prepayment credits are depleted") || errorMessage.includes("429")) {
        errorMessage = "API key đã hết tín dụng. Vui lòng nạp thêm hoặc đổi API key khác.";
      } else if (typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          }
        } catch(e){}
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/proxy-image", async (req, res) => {
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
      res.send(buffer);
    } catch (e: any) {
      console.error("Proxy image error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/detect-grid", async (req, res) => {
    try {
      const { imageBase64, clientGoogleApiKey } = req.body;
      const apiKey = clientGoogleApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg",
              },
            },
            { 
              text: "Analyze this image layout, which contains multiple individual sub-images, panels or frames. Identify all the individual sub-images. Output a JSON array of bounding boxes for each sub-image. Each object in the array should have exactly these properties: `ymin`, `xmin`, `ymax`, `xmax`, all as integers between 0 and 1000. Do not include any other properties. Ensure the bounding boxes accurately cover each separate panel.",
            }
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                ymin: { type: "INTEGER" },
                xmin: { type: "INTEGER" },
                ymax: { type: "INTEGER" },
                xmax: { type: "INTEGER" },
              },
              required: ["ymin", "xmin", "ymax", "xmax"]
            }
          }
        } as any
      });

      const resultText = response.text;
      if (!resultText) {
          console.error("Detect Grid AI returned empty response:", JSON.stringify(response));
          return res.status(500).json({ error: "AI response was empty or blocked." });
      }

      res.json({ result: resultText });
    } catch (error: any) {
      console.error("Server Detect Grid Error:", error);
      let errorMessage = error.message || "Internal Server Error";
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        errorMessage = "API key Google không hợp lệ. Vui lòng kiểm tra lại.";
      } else if (errorMessage.includes("prepayment credits are depleted") || errorMessage.includes("429")) {
        errorMessage = "API key Google đã hết tín dụng. Vui lòng nạp thêm hoặc đổi API key khác.";
      } else if (typeof errorMessage === 'string' && errorMessage.startsWith('{')) {
        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          }
        } catch(e){}
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
