// Picset tab backend — analyze + generate handlers.
// Spec: PICSET-TAB-SPEC.md (Sections 5–8).
//
// Pattern theo tab Ecom hiện tại:
//   - BYOK: nhận key từ frontend (body.keys), fallback env
//   - Tái sử dụng uploadBase64WithFallback + createKieImageTask từ handlers.ts
//   - Trả về taskIds (async) — client poll /api/generate-check
//
// KHÔNG sửa code các tab khác.

import { GoogleGenAI } from "@google/genai";
import { uploadBase64WithFallback, createKieImageTask } from "./handlers.js";

type Req = { body: any; query: any; method?: string };
type Res = {
  status: (code: number) => Res;
  json: (obj: any) => any;
  send: (data: any) => any;
  setHeader: (name: string, value: string) => any;
};

// =================================================================
// Section 6 — Prompt Analyze (GIỮ NGUYÊN 100% — KHÔNG paraphrase)
// =================================================================
const PICSET_ANALYZE_PROMPT = `Bạn là Art Director cho thương hiệu Otama Bedding
({PLATFORM} Việt Nam, định vị trung-cao cấp, khách nữ 22-40).

NHIỆM VỤ 3 BƯỚC. Output TOÀN BỘ dưới dạng JSON hợp lệ, không markdown, không text giải thích.

BRIEF TỪ USER:
{BRIEF}

═══ BƯỚC 1 — PHÂN TÍCH SẢN PHẨM ═══

Phân tích ảnh đính kèm, trả về object "product_analysis":

{
  "product_type": "[loại sản phẩm cụ thể]",
  "set_components": ["[từng món trong set]"],
  "main_colors_hex": ["[3-4 màu chính dạng hex]"],
  "patterns_motifs": "[hoa văn/họa tiết đặc trưng]",
  "fabric_or_material": "[chất liệu]",
  "structural_features": ["[khóa kéo, dây buộc, viền, etc.]"],
  "unique_design_elements": ["[đặc điểm độc đáo]"],
  "common_pain_points": ["[3-5 nỗi đau khách hàng ngành này thường gặp]"],
  "use_scenarios": ["[bối cảnh sử dụng phù hợp]"],
  "target_customer_implied": "[phân khúc khách hàng từ thiết kế]",
  "decorative_props_suggested": ["[5 props lifestyle phù hợp]"]
}

═══ BƯỚC 2 — DESIGN SPECIFICATIONS ═══

Tạo object "design_specs" chung cho TẤT CẢ ảnh:

{
  "visual_style": {
    "keywords": ["5 từ khóa style"],
    "mood_keywords": ["4 từ khóa cảm xúc"],
    "lighting": "[mô tả ánh sáng cụ thể]"
  },
  "color_system": {
    "primary_hex": "[hex từ sản phẩm]",
    "secondary_hex": "[hex]",
    "accent_hex": "[hex]",
    "background_tone": "[mô tả tone nền]"
  },
  "typography": {
    "title_font_style": "[ví dụ: Rounded sans-serif như Quicksand]",
    "body_font_style": "[ví dụ: Clean sans-serif như Montserrat]",
    "main_title_color_hex": "[hex]",
    "subtitle_color_hex": "[hex]",
    "description_color_hex": "[hex]"
  },
  "decorative_props": ["[5 props từ phân tích]"],
  "icon_style": "[mô tả style icon]",
  "quality": {
    "resolution": "4K",
    "realism": "Hyper-realistic/photo-grade"
  },
  "hard_rules": [
    "Không hiển thị tên font, mã hex, header section, label field trong ảnh",
    "Tái hiện chính xác sản phẩm theo ảnh reference, không sửa đổi",
    "Mọi ảnh tuân thủ specs này để đảm bảo nhất quán visual"
  ],
  "user_special_requirements": ["[2-3 yêu cầu cứng từ đặc điểm sản phẩm]"]
}

═══ BƯỚC 3 — IMAGE PLAN ({TARGET_COUNT} ảnh) ═══

Tạo CHÍNH XÁC {TARGET_COUNT} ảnh dựa trên đặc điểm cụ thể sản phẩm.

Phân bổ theo {TARGET_COUNT}:
- N = 1-3: chỉ Hero + 1-2 ảnh quan trọng nhất (USP mạnh nhất)
- N = 4-6: thêm Pain Point + Feature close-up + 1 Scenario
- N = 7-10: bộ chuẩn TMĐT — đủ Hero/Pain/Feature/Scenario/Spec/CTA
- N = 11-15: bộ đầy đủ với Detail close-up nhiều góc + variant + care guide + brand story

Ưu tiên khi giảm số ảnh:
Hero > Pain Point chính > USP feature > Use scenario > Care/Spec > Brand/CTA >
Variant > Detail close-up phụ

Mỗi ảnh có schema chi tiết:

{
  "images": [
    {
      "slot": 1,
      "title_en": "[tiêu đề tiếng Anh — for ref]",
      "title_vi": "[tiêu đề tiếng Việt 4-6 từ]",
      "content_elements": {
        "display_focus": "[CHI TIẾT visual chính — tả như shot list nhiếp ảnh: góc máy, gesture, vật thể, khoảng cách]",
        "pain_point_scenario": "[nỗi đau cụ thể ảnh address. Dạng 'Khách thường gặp X; sản phẩm giải quyết bằng Y'. Để 'N/A' nếu ảnh là hero/CTA/spec]",
        "background_elements": "[mô tả nền + props cụ thể + lighting]"
      },
      "image_within_image": "[null hoặc mô tả sub-element: bảng size, inset zoom, badge, icon set]",
      "text_content_vi": {
        "main_title": "[Việt 2-5 từ, IN HOA hoặc không tùy style]",
        "subtitle": "[Việt 5-10 từ]",
        "description": "[Việt 1 câu hoàn chỉnh max 15 từ]"
      },
      "size_chart": "[null hoặc data table dạng object]",
      "special_requirements": "[yêu cầu cứng riêng ảnh này, hoặc null]"
    }
  ]
}

QUAN TRỌNG:
- "display_focus" PHẢI tả như shot list nhiếp ảnh chuyên nghiệp
- "pain_point_scenario" PHẢI cụ thể:
  ❌ "Sản phẩm chất lượng cao"
  ✅ "Vỏ gối thường tuột ra giữa đêm; vỏ gối envelope-style ôm trọn ruột"
- "background_elements" PHẢI tả props cụ thể (laptop, cốc cà phê, sách)
- Text Việt giọng Shopee/TikTok, KHÔNG Hán-Việt cứng
- {TARGET_COUNT} ảnh KHÔNG được lặp ý/scene
- Mỗi ảnh gắn với 1 feature đã phân tích ở Bước 1

═══ OUTPUT FORMAT ═══

Trả về DUY NHẤT 1 JSON object có cấu trúc:

{
  "product_analysis": { ... },
  "design_specs": { ... },
  "images": [ ... {TARGET_COUNT} items ]
}

KHÔNG markdown code fence. KHÔNG text giải thích. KHÔNG \`\`\`json. Trả JSON thuần.`;

// =================================================================
// Section 5 — Blueprint schema validation
// =================================================================
function validateBlueprint(b: any, targetCount: number): { ok: boolean; error?: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Blueprint không phải object' };
  if (!b.product_analysis || typeof b.product_analysis !== 'object') return { ok: false, error: 'Thiếu product_analysis' };
  if (!b.design_specs || typeof b.design_specs !== 'object') return { ok: false, error: 'Thiếu design_specs' };
  if (!b.design_specs.color_system) return { ok: false, error: 'Thiếu design_specs.color_system' };
  if (!b.design_specs.visual_style) return { ok: false, error: 'Thiếu design_specs.visual_style' };
  if (!b.design_specs.typography) return { ok: false, error: 'Thiếu design_specs.typography' };
  if (!Array.isArray(b.images)) return { ok: false, error: 'Thiếu images array' };
  if (b.images.length !== targetCount) {
    return { ok: false, error: `Cần ${targetCount} ảnh nhưng AI trả ${b.images.length}` };
  }
  for (let i = 0; i < b.images.length; i++) {
    const img = b.images[i];
    if (!img.content_elements) return { ok: false, error: `Ảnh slot ${i + 1} thiếu content_elements` };
    if (!img.text_content_vi) return { ok: false, error: `Ảnh slot ${i + 1} thiếu text_content_vi` };
  }
  return { ok: true };
}

function buildAnalyzePrompt(targetCount: number, brief: string, platform: string, language: string): string {
  return PICSET_ANALYZE_PROMPT
    .split('{TARGET_COUNT}').join(String(targetCount))
    .split('{BRIEF}').join((brief || '(không có brief bổ sung — phân tích thuần từ ảnh)').trim())
    .split('{PLATFORM}').join(platform || 'Shopee')
    .split('{LANGUAGE}').join(language || 'Vietnamese');
}

function stripJsonFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

// =================================================================
// Section 7 — Build final prompt per image
// =================================================================
function buildPicsetFinalPrompt(image: any, designSpecs: any): string {
  const vs = designSpecs.visual_style || {};
  const cs = designSpecs.color_system || {};
  const ty = designSpecs.typography || {};
  const ce = image.content_elements || {};
  const tc = image.text_content_vi || {};

  const painPointLine = ce.pain_point_scenario && ce.pain_point_scenario !== 'N/A'
    ? `Pain Point Scenario: ${ce.pain_point_scenario}`
    : '';
  const insetLine = image.image_within_image
    ? `Image-within-Image: ${image.image_within_image}`
    : '';
  const specialLine = image.special_requirements
    ? `Special requirement for this image: ${image.special_requirements}`
    : '';
  const hardRules = Array.isArray(designSpecs.hard_rules) ? designSpecs.hard_rules : [];

  return `帮我给我们这件产品做一个高级感的电商详情页图片,
像山下有松的风格表达售卖详情。

═══ DESIGN SPECIFICATIONS (apply to entire set) ═══

Visual Style: ${(vs.keywords || []).join(', ')}
Mood: ${(vs.mood_keywords || []).join(', ')}
Lighting: ${vs.lighting || ''}

Color Palette:
- Primary: ${cs.primary_hex || ''}
- Secondary: ${cs.secondary_hex || ''}
- Accent: ${cs.accent_hex || ''}
- Background tone: ${cs.background_tone || ''}

Typography:
- Title font style: ${ty.title_font_style || ''}
- Body font style: ${ty.body_font_style || ''}

Decorative props available: ${(designSpecs.decorative_props || []).join(', ')}
Icon style: ${designSpecs.icon_style || ''}
Quality: ${designSpecs.quality?.resolution || '4K'}, ${designSpecs.quality?.realism || 'Hyper-realistic'}

═══ THIS IMAGE ═══

Title: ${image.title_en || image.title_vi || ''}

Display Focus: ${ce.display_focus || ''}

${painPointLine}

Background Elements: ${ce.background_elements || ''}

${insetLine}

═══ TEXT CONTENT (in Vietnamese) ═══

Main Title: "${tc.main_title || ''}"
Subtitle: "${tc.subtitle || ''}"
Description: "${tc.description || ''}"

═══ HARD RULES ═══

${hardRules.map((r: string) => `- ${r}`).join('\n')}

${specialLine}

═══ LANGUAGE & DIACRITICS ═══

所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`.trim();
}

// =================================================================
// /api/picset/analyze
// =================================================================
// Body: { imageBase64, brief?, targetCount?, targetPlatform?, language?, keys: { gemini } }
// Returns: { blueprint: Blueprint }
export async function handlePicsetAnalyze(req: Req, res: Res) {
  try {
    const body = req.body || {};
    const imageBase64: string | undefined = body.imageBase64;
    const brief: string = (body.brief || '').toString();
    const targetCount: number = Number(body.targetCount ?? 8);
    const targetPlatform: string = (body.targetPlatform || 'Shopee').toString();
    const language: string = (body.language || 'Vietnamese').toString();
    const apiKey: string | undefined = body.keys?.gemini || body.clientGoogleApiKey || process.env.GEMINI_API_KEY;

    if (!imageBase64) return res.status(400).json({ error: 'Thiếu ảnh sản phẩm (imageBase64).' });
    if (!Number.isFinite(targetCount) || targetCount < 1 || targetCount > 15) {
      return res.status(400).json({ error: 'Số lượng ảnh phải từ 1-15.' });
    }
    if (!apiKey) return res.status(401).json({ error: 'Thiếu API key Gemini. Vui lòng nhập trong cài đặt Picset.' });

    const basePrompt = buildAnalyzePrompt(targetCount, brief, targetPlatform, language);
    const ai = new GoogleGenAI({ apiKey });

    const callOnce = async (strictMode: boolean): Promise<string | null> => {
      const finalText = strictMode
        ? `${basePrompt}\n\n⚠️ STRICT JSON ONLY. Không markdown, không code fence \`\`\`, không text giải thích. Chỉ JSON thuần.`
        : basePrompt;
      const modelsToTry = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.0-flash'];
      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [
              { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
              { text: finalText },
            ]},
            config: { responseMimeType: 'application/json' } as any,
          });
          if (response.text) {
            console.log(`[picset] analyze succeeded with ${modelName} (strict=${strictMode})`);
            return response.text;
          }
        } catch (e: any) {
          const msg = (e?.message || '').slice(0, 160);
          const isOverload = msg.includes('high demand') || msg.includes('UNAVAILABLE') || msg.includes('overloaded') || msg.includes('503');
          console.warn(`[picset] analyze ${modelName} failed: ${msg}`);
          if (!isOverload) throw e;
        }
      }
      return null;
    };

    let raw = await callOnce(false);
    let blueprint: any = null;
    let lastErr: any = null;

    if (raw) {
      try {
        const cleaned = stripJsonFence(raw);
        blueprint = JSON.parse(cleaned);
        const v = validateBlueprint(blueprint, targetCount);
        if (!v.ok) {
          console.warn(`[picset] validate fail (first try): ${v.error}`);
          blueprint = null;
          lastErr = new Error(v.error);
        }
      } catch (e: any) {
        console.warn(`[picset] parse fail (first try): ${e?.message}`);
        lastErr = e;
      }
    }

    // Retry once with strict instruction if first attempt failed
    if (!blueprint) {
      console.log('[picset] retrying analyze with strict JSON instruction');
      raw = await callOnce(true);
      if (raw) {
        try {
          const cleaned = stripJsonFence(raw);
          blueprint = JSON.parse(cleaned);
          const v = validateBlueprint(blueprint, targetCount);
          if (!v.ok) throw new Error(v.error);
        } catch (e: any) {
          lastErr = e;
          blueprint = null;
        }
      }
    }

    if (!blueprint) {
      return res.status(500).json({
        error: `Không parse được blueprint từ AI sau 2 lần thử: ${lastErr?.message || 'unknown'}`,
        rawSample: raw?.slice(0, 500) || null,
      });
    }

    return res.json({ blueprint });
  } catch (error: any) {
    console.error('[api] Picset analyze error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}

// =================================================================
// /api/picset/generate
// =================================================================
// Body: {
//   images: Array<image spec>,          // từ blueprint.images (đã user edit)
//   designSpecs: object,                // blueprint.design_specs
//   productImageBase64: string,         // ảnh sản phẩm chính
//   model?: 'gpt2' | 'banana-pro',      // default banana-pro
//   aspectRatio?: string,               // '4:5', '1:1', ...
//   quality?: '1K'|'2K'|'4K',           // default 2K
//   keys: { kie }
// }
// Returns: { tasks: Array<{ slot, taskId|null, error|null }>, isAsync: true }
// Client tiếp tục poll /api/generate-check theo từng taskId.
export async function handlePicsetGenerate(req: Req, res: Res) {
  try {
    const body = req.body || {};
    const images = Array.isArray(body.images) ? body.images : [];
    const designSpecs = body.designSpecs;
    const productImageBase64: string | undefined = body.productImageBase64;
    const modelChoice: 'gpt2' | 'banana-pro' = body.model === 'gpt2' ? 'gpt2' : 'banana-pro';
    const aspectRatio: string = (body.aspectRatio || '4:5').toString();
    const quality: string = (body.quality || '2K').toString().toUpperCase();
    const apiKey: string | undefined = body.keys?.kie || body.clientKieApiKey || process.env.KIE_API_KEY;

    if (images.length === 0) return res.status(400).json({ error: 'Thiếu danh sách images.' });
    if (!designSpecs) return res.status(400).json({ error: 'Thiếu designSpecs.' });
    if (!productImageBase64) return res.status(400).json({ error: 'Thiếu ảnh sản phẩm (productImageBase64).' });
    if (!apiKey) return res.status(401).json({ error: 'Thiếu API key kie.ai. Vui lòng nhập trong cài đặt Picset.' });

    const kieModelId = modelChoice === 'gpt2' ? 'gpt-image-2-image-to-image' : 'nano-banana-pro';

    // Upload product image once, reuse URL for all tasks
    let inputUrl: string;
    try {
      inputUrl = await uploadBase64WithFallback(productImageBase64, apiKey);
    } catch (e: any) {
      return res.status(500).json({ error: `Lỗi upload ảnh sản phẩm: ${e?.message || 'unknown'}` });
    }

    // Create N kie tasks in parallel — Promise.allSettled to keep partial success
    const settled = await Promise.allSettled(
      images.map(async (img: any) => {
        const prompt = buildPicsetFinalPrompt(img, designSpecs);
        const taskId = await createKieImageTask(kieModelId, [inputUrl], prompt, apiKey!, aspectRatio, quality);
        return { slot: img.slot, taskId };
      })
    );

    const tasks = settled.map((r, i) => {
      const slot = images[i]?.slot ?? i + 1;
      if (r.status === 'fulfilled') return { slot: r.value.slot, taskId: r.value.taskId, error: null };
      return { slot, taskId: null, error: (r.reason as Error)?.message || 'Tạo task fail' };
    });

    console.log(`[picset] generate created ${tasks.filter(t => t.taskId).length}/${tasks.length} tasks (model=${kieModelId}, aspect=${aspectRatio}, quality=${quality})`);
    return res.json({ tasks, isAsync: true });
  } catch (error: any) {
    console.error('[api] Picset generate error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
