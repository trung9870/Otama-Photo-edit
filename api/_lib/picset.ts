// Picset tab backend — analyze + generate handlers.
// Spec: PICSET-TAB-SPEC.md (Sections 5–8).
//
// Pattern theo tab Ecom hiện tại:
//   - BYOK: nhận key từ frontend (body.keys), fallback env
//   - Tái sử dụng uploadBase64WithFallback + createKieImageTask từ handlers.ts
//   - Trả về taskIds (async) — client poll /api/generate-check
//
// KHÔNG sửa code các tab khác.

import { uploadBase64WithFallback, createKieImageTask, formatGeminiError } from "./handlers.js";
import {
  PICSET_LANGUAGE_VI,
  PICSET_CATEGORIES,
  PICSET_CATEGORY_IDS,
  buildCategoryBlock,
  fallbackCategoryForSlot,
  isValidPicsetCategory,
  type PicsetCategoryId,
} from "./picsetCategories.js";

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

QUAN TRỌNG: Mỗi ảnh PHẢI gắn với 1 "category" trong 16 đề mục dưới đây.
Category quyết định layout, mật độ chữ, và design language tiếng Trung của ảnh.

═══ 16 CATEGORIES ĐỂ CHỌN (dùng id snake_case bên trái) ═══

1. hero_image            (视觉开篇 — Thị giác mở màn) — Ảnh chính, hero shot ấn tượng đầu
2. core_value            (价值暴击 — Đánh mạnh giá trị) — Đánh mạnh giá trị/USP
3. lifestyle_scene       (场景沉浸 — Đắm chìm bối cảnh) — Lifestyle, đắm chìm bối cảnh
4. full_view             (全景观感 — Cảm quan toàn cảnh) — Cảm quan toàn cảnh, full view
5. mood_atmosphere       (氛围造境 — Tạo dựng không khí) — Mood, ánh sáng, không khí
6. macro_texture         (质感暴击 — Đánh mạnh chất liệu) — Macro close-up chất liệu
7. brand_story           (品牌格调 — Phong cách thương hiệu) — Phong cách thương hiệu
8. size_reference        (规格参照 — Tham chiếu kích thước) — Tham chiếu kích thước với vật quen
9. competitive_advantage (价值差异 — Khác biệt giá trị) — So sánh với đối thủ
10. spec_table           (规格说明 — Thông số kỹ thuật) — Bảng thông số kỹ thuật
11. craftsmanship        (匠心工艺 — Nghệ nhân thủ công) — Đường may, chi tiết thủ công
12. exploded_view        (配件展示 — Trưng bày phụ kiện) — Bóc tách phụ kiện trong set
13. full_lineup          (全系呈现 — Hiển thị toàn dòng) — Bảng màu/variant catalog
14. safety_cert          (成分安心 — Thành phần an tâm) — Chứng chỉ an toàn
15. warranty             (无忧保障 — Bảo vệ vô lo) — Bảo hành, đổi trả
16. usage_guide          (使用示意 — Minh họa sử dụng) — Hướng dẫn dùng, bảo quản

Logic phân bổ:
- N = 1-3: hero_image + 1-2 quan trọng nhất (core_value/macro_texture)
- N = 4-6: thêm lifestyle_scene + craftsmanship + 1 spec
- N = 7-10: bộ chuẩn — hero/core/lifestyle/macro/craft/spec/lineup/usage
- N = 11-15: thêm size_reference/competitive_advantage/safety_cert/warranty/brand_story

Lưu ý chọn category:
- macro_texture, craftsmanship → chỉ chọn nếu sản phẩm có texture/đường may đáng zoom
- exploded_view → chỉ chọn nếu sản phẩm là set nhiều món
- full_lineup → chỉ chọn nếu sản phẩm có nhiều variant màu
- size_reference → chỉ chọn nếu kích thước là feature bán hàng

Mỗi ảnh có schema CHI TIẾT (bám sát đầy đủ các field bên dưới):

{
  "images": [
    {
      "slot": 1,
      "category": "hero_image",
      "title_en": "[tiêu đề tiếng Anh ngắn — VD: 'Main Visual - The Lucky Whale Mug']",
      "title_vi": "[tiêu đề tiếng Việt 4-6 từ — VD: 'Bộ Ly Cá Voi May Mắn']",
      "outer_description": "[1 câu mô tả ngắn (EN, 12-20 từ) thể hiện ý đồ tổng quan của ảnh]",
      "image_category": "[CHỌN 1 trong 6 enum cũ: 'Feature Image' | 'Pain Point Image' | 'Detail / Material Image' | 'Selling Point Image' | 'Scene Image' | 'Specification / Parameter Image' — đây là phân loại broad, song song với category]",
      "complex_structure_assessment": [true nếu ảnh có ghép nhiều panel/inset/before-after/grid; ngược lại false],
      "design_objective": "[1-2 câu (EN) trả lời: ảnh này nhằm đạt được gì cho user?]",
      "product_appearance": [true nếu sản phẩm xuất hiện trực tiếp; false nếu chỉ là CTA/brand-only],
      "image_within_image": "[null hoặc mô tả sub-element: bảng size, inset zoom, badge, icon set, before/after panel]",
      "content_elements": {
        "display_focus": "[CHI TIẾT visual chính — tả như shot list nhiếp ảnh chuyên nghiệp: góc máy, gesture, vật thể, khoảng cách, depth-of-field. 2-3 câu, KHÔNG được sơ sài.]",
        "pain_point_scenario": "[nỗi đau cụ thể ảnh address. Dạng 'Khách thường gặp X; sản phẩm giải quyết bằng Y'. Để 'N/A' nếu ảnh là Feature/Scene/Specification]",
        "background_elements": "[mô tả nền + props cụ thể (tên vật thể, vị trí) + lighting + texture. 1-2 câu chi tiết.]"
      },
      "text_content_vi": {
        "main_title": "[Việt 2-5 từ, IN HOA hoặc không tùy style]",
        "subtitle": "[Việt 5-10 từ]",
        "description": "[Việt 1 câu hoàn chỉnh max 15 từ]"
      },
      "size_chart": "[null hoặc data table dạng object với rows + columns]",
      "special_requirements": "[yêu cầu cứng riêng ảnh này — VD focus phải sharp, glitter effect, dimension lines mảnh — hoặc null]"
    }
  ]
}

QUAN TRỌNG:
- "category" PHẢI là id tiếng Anh snake_case CHÍNH XÁC từ list 16 trên (vd "hero_image", KHÔNG phải "Hero Image" hay "视觉开篇")
- KHÔNG được lặp category cho 2 ảnh khác nhau trừ khi N > 12
- "image_category" CHỈ chọn 1 string TỪ 6 VALUE BÊN DƯỚI, KHÔNG được gộp / hyphenate / bịa:
  ✅ "Scene Image"
  ✅ "Specification / Parameter Image"
  ❌ "Usage / Scene Image"  (gộp 2 cái — SAI)
  ❌ "Detail/Scene Image"   (bịa hybrid — SAI)
  ❌ "Usage Image"          (bịa enum mới — SAI)
- "design_objective" PHẢI cụ thể (KHÔNG generic). Phải trả lời được "vì sao user cần ảnh này"
- "outer_description" KHÁC với title — nó là 1 câu summary đi kèm title
- "display_focus" PHẢI tả như shot list nhiếp ảnh chuyên nghiệp, KHÔNG được 1 dòng sơ sài
- "pain_point_scenario" PHẢI cụ thể:
  ❌ "Sản phẩm chất lượng cao"
  ✅ "Vỏ gối thường tuột ra giữa đêm; vỏ gối envelope-style ôm trọn ruột"
- "background_elements" PHẢI tả props cụ thể (laptop, cốc cà phê, sách, dạng vị trí + lighting)
- Text Việt giọng Shopee/TikTok, KHÔNG Hán-Việt cứng
- Mỗi ảnh gắn với 1 feature/pain_point/scenario đã phân tích ở Bước 1
- "complex_structure_assessment" = true chỉ khi cần composite phức tạp (inset, multiple panels). Phần lớn ảnh là false.

═══ OUTPUT FORMAT ═══

Trả về DUY NHẤT 1 JSON object có cấu trúc:

{
  "product_analysis": { ... },
  "design_specs": { ... },
  "images": [ ... {TARGET_COUNT} items ]
}

KHÔNG markdown code fence. KHÔNG text giải thích. KHÔNG \`\`\`json. Trả JSON thuần.

═══ FIELD CHECKLIST CHO MỖI IMAGE (BẮT BUỘC ĐẦY ĐỦ) ═══

Trước khi return JSON, kiểm tra MỖI ảnh đã có ĐỦ các field sau (không được thiếu, không được rỗng):
□ slot                          (number, 1..N)
□ category                      (EXACT 1 trong 16 snake_case id: hero_image | core_value | lifestyle_scene | full_view | mood_atmosphere | macro_texture | brand_story | size_reference | competitive_advantage | spec_table | craftsmanship | exploded_view | full_lineup | safety_cert | warranty | usage_guide)
□ title_en                      (English title)
□ title_vi                      (Vietnamese title 4-6 từ)
□ outer_description             (English 12-20 từ — summary đi kèm title)
□ image_category                (EXACT 1 trong 6 broad enum: "Feature Image" | "Pain Point Image" | "Detail / Material Image" | "Selling Point Image" | "Scene Image" | "Specification / Parameter Image")
□ design_objective              (English 1-2 câu — vì sao user cần ảnh này)
□ product_appearance            (boolean true/false)
□ complex_structure_assessment  (boolean — true chỉ khi composite phức tạp)
□ image_within_image            (null hoặc string mô tả)
□ content_elements.display_focus       (Vietnamese 2-3 câu shot list)
□ content_elements.pain_point_scenario (Vietnamese hoặc "N/A")
□ content_elements.background_elements (Vietnamese 1-2 câu chi tiết)
□ text_content_vi.main_title    (2-5 từ Việt)
□ text_content_vi.subtitle      (5-10 từ Việt)
□ text_content_vi.description   (1 câu Việt max 15 từ)
□ size_chart                    (null hoặc object)
□ special_requirements          (null hoặc string)

NẾU THIẾU BẤT KỲ FIELD NÀO Ở TRÊN, output sẽ bị REJECT và bạn phải tạo lại.`;

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
  const VALID_CATEGORIES = new Set([
    'Feature Image',
    'Pain Point Image',
    'Detail / Material Image',
    'Selling Point Image',
    'Scene Image',
    'Specification / Parameter Image',
  ]);
  for (let i = 0; i < b.images.length; i++) {
    const img = b.images[i];
    if (!img.content_elements) return { ok: false, error: `Ảnh slot ${i + 1} thiếu content_elements` };
    if (!img.text_content_vi) return { ok: false, error: `Ảnh slot ${i + 1} thiếu text_content_vi` };
    // PATCH §8: Chinese category — STRICT required (this is the primary prompt-driver)
    if (!isValidPicsetCategory(img.category)) {
      return { ok: false, error: `Ảnh slot ${i + 1} thiếu/sai field "category" — phải là 1 trong ${PICSET_CATEGORY_IDS.length} snake_case id (vd "hero_image"). Got: "${img.category}"` };
    }
    // image_category (6 broad enum) — SOFT: accept any string, normalize to valid value if mismatch
    if (!img.image_category || typeof img.image_category !== 'string') {
      img.image_category = inferBroadImageCategory(img.category);
    } else if (!VALID_CATEGORIES.has(img.image_category)) {
      console.warn(`[picset] slot ${i + 1} image_category invented "${img.image_category}" — coercing to broad fallback`);
      img.image_category = inferBroadImageCategory(img.category, img.image_category);
    }
    if (!img.design_objective || typeof img.design_objective !== 'string' || img.design_objective.trim().length < 10) {
      return { ok: false, error: `Ảnh slot ${i + 1} thiếu design_objective (cần >=10 ký tự)` };
    }
    if (!img.outer_description || typeof img.outer_description !== 'string' || img.outer_description.trim().length < 10) {
      return { ok: false, error: `Ảnh slot ${i + 1} thiếu outer_description (cần >=10 ký tự)` };
    }
    if (typeof img.product_appearance !== 'boolean') {
      return { ok: false, error: `Ảnh slot ${i + 1} thiếu product_appearance (boolean)` };
    }
    // complex_structure_assessment optional — coerce
    img.complex_structure_assessment = !!img.complex_structure_assessment;
    // Display focus must be substantive (>=40 chars to enforce 2-3 sentences)
    if (!img.content_elements.display_focus || img.content_elements.display_focus.trim().length < 40) {
      return { ok: false, error: `Ảnh slot ${i + 1} display_focus quá ngắn — cần shot list chi tiết` };
    }
  }
  return { ok: true };
}

// Map Chinese 16-category → broad 6-enum for soft image_category fallback.
// Used when AI invents a hybrid like "Usage / Scene Image" or omits the field.
const BROAD_CATEGORY_MAP: Record<string, string> = {
  hero_image:             'Feature Image',
  core_value:             'Selling Point Image',
  lifestyle_scene:        'Scene Image',
  full_view:              'Feature Image',
  mood_atmosphere:        'Scene Image',
  macro_texture:          'Detail / Material Image',
  brand_story:            'Scene Image',
  size_reference:         'Specification / Parameter Image',
  competitive_advantage:  'Pain Point Image',
  spec_table:             'Specification / Parameter Image',
  craftsmanship:          'Detail / Material Image',
  exploded_view:          'Selling Point Image',
  full_lineup:            'Feature Image',
  safety_cert:            'Specification / Parameter Image',
  warranty:               'Specification / Parameter Image',
  usage_guide:            'Scene Image',
};

function inferBroadImageCategory(chineseCat: string, hint?: string): string {
  // If AI's invented string contains a known broad name as substring, use it.
  if (hint) {
    const broadNames = ['Pain Point Image', 'Detail / Material Image', 'Selling Point Image', 'Scene Image', 'Specification / Parameter Image', 'Feature Image'];
    for (const name of broadNames) {
      if (hint.includes(name)) return name;
    }
    // Hint by keyword
    const lower = hint.toLowerCase();
    if (lower.includes('pain')) return 'Pain Point Image';
    if (lower.includes('detail') || lower.includes('material') || lower.includes('texture')) return 'Detail / Material Image';
    if (lower.includes('selling') || lower.includes('value')) return 'Selling Point Image';
    if (lower.includes('scene') || lower.includes('lifestyle') || lower.includes('usage') || lower.includes('mood')) return 'Scene Image';
    if (lower.includes('spec') || lower.includes('parameter') || lower.includes('size') || lower.includes('warranty')) return 'Specification / Parameter Image';
  }
  return BROAD_CATEGORY_MAP[chineseCat] || 'Feature Image';
}

// Coerce missing `category` on legacy blueprints (PATCH §8 edge case).
function coerceLegacyCategories(blueprint: any) {
  if (!blueprint || !Array.isArray(blueprint.images)) return;
  blueprint.images.forEach((img: any, idx: number) => {
    if (!isValidPicsetCategory(img?.category)) {
      img.category = fallbackCategoryForSlot(idx);
    }
  });
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
// Section 7 — Build final prompt per image (PATCH §5: Chinese-heavy)
// =================================================================
function buildPicsetFinalPrompt(image: any, designSpecs: any): string {
  // 1. Validate category (legacy blueprints coerced upstream via coerceLegacyCategories)
  const categoryId: PicsetCategoryId = isValidPicsetCategory(image.category)
    ? image.category
    : fallbackCategoryForSlot((image.slot ?? 1) - 1);
  const catMeta = PICSET_CATEGORIES[categoryId];

  // 2. Chinese design block (header + focus + density + reference brands)
  const categoryBlock = buildCategoryBlock(categoryId);

  const ce = image.content_elements || {};
  const tc = image.text_content_vi || {};

  // 3. Image-specifics — mixed Chinese labels + content
  const titleLine = image.title_en || image.title_vi
    ? `Image Title: ${[image.title_en, image.title_vi].filter(Boolean).join(' / ')}\n`
    : '';
  const conceptLine = image.outer_description
    ? `Concept / 整体概念:\n${image.outer_description}\n`
    : '';
  const objectiveLine = image.design_objective
    ? `Design Objective / 设计目标:\n${image.design_objective}\n`
    : '';
  const painPointBlock =
    ce.pain_point_scenario && ce.pain_point_scenario !== 'N/A'
      ? `Pain Point Scenario / 痛点场景:\n${ce.pain_point_scenario}\n`
      : '';
  const insetBlock = image.image_within_image
    ? `Image-within-Image / 图中图元素:\n${image.image_within_image}\n`
    : '';

  // Size chart — render as readable table if present (important for spec_table category)
  let sizeChartBlock = '';
  if (image.size_chart && typeof image.size_chart === 'object') {
    try {
      sizeChartBlock = `Size Chart / 尺寸表:\n${JSON.stringify(image.size_chart, null, 2)}\n`;
    } catch {
      // fall through
    }
  } else if (typeof image.size_chart === 'string' && image.size_chart.trim()) {
    sizeChartBlock = `Size Chart / 尺寸表:\n${image.size_chart}\n`;
  }

  // Layout hint when AI flagged complex composite (inset/grid/before-after)
  const compositeLine = image.complex_structure_assessment
    ? `Layout Note: This is a complex composite (use insets / split panels / grid layout).\n`
    : '';
  // Product appearance — when explicitly false, tell AI not to over-feature product
  const appearanceLine = image.product_appearance === false
    ? `Product Appearance: false — focus on brand/lifestyle context, product may be absent or peripheral.\n`
    : '';

  const imageSpecifics = `═══ THIS IMAGE — 本图详情 ═══

Category: ${catMeta.cn_name} (${catMeta.vi_name})

${titleLine}${conceptLine}${objectiveLine}Display Focus / 展示重点:
${ce.display_focus || ''}

${painPointBlock}Background Elements / 背景元素:
${ce.background_elements || ''}

${insetBlock}${sizeChartBlock}${compositeLine}${appearanceLine}`.trim();

  // 4. Design specs from blueprint
  const vs = designSpecs.visual_style || {};
  const cs = designSpecs.color_system || {};
  const ty = designSpecs.typography || {};
  const designSection = `═══ DESIGN SPECIFICATIONS (from blueprint) ═══

Visual Style: ${(vs.keywords || []).join(', ')}
Mood: ${(vs.mood_keywords || []).join(', ')}
Lighting: ${vs.lighting || ''}

Color Palette:
- Primary: ${cs.primary_hex || ''}
- Secondary: ${cs.secondary_hex || ''}
- Accent: ${cs.accent_hex || ''}
- Background: ${cs.background_tone || ''}

Typography:
- Title font: ${ty.title_font_style || ''}
- Body font: ${ty.body_font_style || ''}
- Main title color: ${ty.main_title_color_hex || ''}
- Subtitle color: ${ty.subtitle_color_hex || ''}

Decorative props (use 2-3): ${(designSpecs.decorative_props || []).join(', ')}
Icon style: ${designSpecs.icon_style || ''}
Quality: ${designSpecs.quality?.resolution || '4K'}, ${designSpecs.quality?.realism || 'Hyper-realistic'}`;

  // 5. Vietnamese text overlay
  const textContent = `═══ TEXT CONTENT (Vietnamese — render exactly) ═══

Main Title: "${tc.main_title || ''}"
Subtitle: "${tc.subtitle || ''}"
Description: "${tc.description || ''}"`;

  // 6. Hard rules + user special req (from design_specs) + per-image special req
  const hardRules = Array.isArray(designSpecs.hard_rules) ? designSpecs.hard_rules : [];
  const userSpecialReqs = Array.isArray(designSpecs.user_special_requirements)
    ? designSpecs.user_special_requirements
    : [];
  const allRules = [...hardRules, ...userSpecialReqs];
  const specialLine = image.special_requirements
    ? `Special for this image: ${image.special_requirements}`
    : '';
  const rulesSection = `═══ HARD RULES ═══

${allRules.map((r: string) => `- ${r}`).join('\n')}

${specialLine}`.trim();

  // 7. Final assembly — Chinese block first, then specifics, design, text, rules, language
  return [
    categoryBlock,
    '',
    imageSpecifics,
    '',
    designSection,
    '',
    textContent,
    '',
    rulesSection,
    '',
    PICSET_LANGUAGE_VI,
  ].join('\n');
}

// =================================================================
// Kie.ai OpenAI-compatible chat completions for Gemini 3.5 Flash.
// Endpoint: https://api.kie.ai/gemini-3-5-flash-openai/v1/chat/completions
// Image input must be a URL (Kie spec) — we upload base64 to a temp host first.
// =================================================================
async function analyzeViaKie(opts: {
  imageBase64: string;
  refImagesBase64?: string[];
  prompt: string;
  kieApiKey: string;
}): Promise<{ text: string | null; modelUsed: string }> {
  // Upload main + optional refs in parallel → URLs (kie.ai > catbox > tmpfiles > 0x0)
  const refs = (opts.refImagesBase64 || []).filter(b => typeof b === 'string' && b.length > 0);
  const allUploads = await Promise.all(
    [opts.imageBase64, ...refs].map(b => uploadBase64WithFallback(b, opts.kieApiKey))
  );
  const mainUrl = allUploads[0];
  const refUrls = allUploads.slice(1);

  // Compose content parts: text first, then main image, then ref images (with index tags so AI knows main vs ref)
  const content: any[] = [{ type: 'text', text: opts.prompt }];
  content.push(
    { type: 'text', text: '[Ảnh chính sản phẩm — dùng làm nguồn gốc khi gen]:' },
    { type: 'image_url', image_url: { url: mainUrl } },
  );
  refUrls.forEach((url, i) => {
    content.push(
      { type: 'text', text: `[Ảnh tham khảo ${i + 1} — góc/detail/packaging khác của cùng sản phẩm, dùng để hiểu thêm ngữ cảnh]:` },
      { type: 'image_url', image_url: { url } },
    );
  });

  const endpoint = 'https://api.kie.ai/gemini-3-5-flash-openai/v1/chat/completions';
  const body = {
    model: 'gemini-3-5-flash',
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
    stream: false,
  };

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
  const text: string | null = data?.choices?.[0]?.message?.content || null;
  const modelUsed: string = data?.model || 'gemini-3-5-flash';
  return { text, modelUsed };
}

// =================================================================
// /api/picset/analyze
// =================================================================
// Body: { imageBase64, refImagesBase64?, brief?, targetCount?, targetPlatform?, language?, clientKieApiKey }
// Returns: { blueprint: Blueprint }
// Provider: Kie.ai → Gemini 3.5 Flash (OpenAI-compatible endpoint).
// Tận dụng credit Kie sẵn có thay vì Gemini direct (hay hết credit).
// Ref images: optional 0-3 ảnh phụ — Gemini đọc cùng ảnh chính để tăng độ chính xác blueprint.
export async function handlePicsetAnalyze(req: Req, res: Res) {
  try {
    const body = req.body || {};
    const imageBase64: string | undefined = body.imageBase64;
    const refImagesBase64: string[] = Array.isArray(body.refImagesBase64)
      ? body.refImagesBase64.filter((b: any) => typeof b === 'string' && b.length > 0).slice(0, 3)
      : [];
    const brief: string = (body.brief || '').toString();
    const targetCount: number = Number(body.targetCount ?? 8);
    const targetPlatform: string = (body.targetPlatform || 'Shopee').toString();
    const language: string = (body.language || 'Vietnamese').toString();
    // BYOK: Kie key — analyze giờ chạy qua Kie.ai (Gemini 3.5 Flash OpenAI-compatible)
    const kieApiKey: string | undefined = body.clientKieApiKey || body.keys?.kie || process.env.KIE_API_KEY;

    if (!imageBase64) return res.status(400).json({ error: 'Thiếu ảnh sản phẩm (imageBase64).' });
    if (!Number.isFinite(targetCount) || targetCount < 1 || targetCount > 15) {
      return res.status(400).json({ error: 'Số lượng ảnh phải từ 1-15.' });
    }
    if (!kieApiKey) return res.status(401).json({ error: 'Thiếu API key Kie. Vui lòng nhập trong cài đặt.' });

    const basePrompt = buildAnalyzePrompt(targetCount, brief, targetPlatform, language);

    const callOnce = async (strictMode: boolean, prevError?: string): Promise<string | null> => {
      const finalText = strictMode
        ? `${basePrompt}\n\n⚠️ LẦN TRƯỚC OUTPUT BỊ REJECT vì: ${prevError || 'không hợp lệ'}.\nLần này PHẢI có ĐỦ field theo FIELD CHECKLIST ở trên. STRICT JSON ONLY. Không markdown, không code fence \`\`\`, không text giải thích. Chỉ JSON thuần.`
        : basePrompt;
      try {
        const { text, modelUsed } = await analyzeViaKie({
          imageBase64,
          refImagesBase64,
          prompt: finalText,
          kieApiKey,
        });
        if (text) {
          console.log(`[picset] analyze succeeded via Kie/${modelUsed} (strict=${strictMode}, refs=${refImagesBase64.length})`);
          return text;
        }
      } catch (e: any) {
        const msg = (e?.message || '').slice(0, 200);
        console.warn(`[picset] analyze Kie call failed: ${msg}`);
        throw e;
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
      console.log(`[picset] retrying analyze with strict JSON instruction — prev error: ${lastErr?.message}`);
      raw = await callOnce(true, lastErr?.message);
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
    const msg: string = error?.message || 'Internal Server Error';
    // Kie chat completions có thể trả lỗi 401/402 nếu key sai/hết credit
    if (msg.includes('HTTP 401') || msg.includes('Unauthorized')) {
      return res.status(401).json({ error: 'API key Kie không hợp lệ. Vui lòng kiểm tra lại trong Settings.' });
    }
    if (msg.includes('HTTP 402') || msg.includes('insufficient') || msg.includes('credit')) {
      return res.status(402).json({ error: 'Tài khoản Kie không đủ credit. Vui lòng nạp thêm tại kie.ai/billing.' });
    }
    if (msg.includes('HTTP 429') || msg.includes('rate limit')) {
      return res.status(429).json({ error: 'Kie đang quá tải hoặc đụng rate limit. Đợi 1 phút rồi thử lại.' });
    }
    return res.status(500).json({ error: msg });
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
    if (images.length > 16) return res.status(400).json({ error: 'Picset chỉ hỗ trợ tối đa 16 ảnh / batch.' });
    if (!designSpecs) return res.status(400).json({ error: 'Thiếu designSpecs.' });
    if (!productImageBase64) return res.status(400).json({ error: 'Thiếu ảnh sản phẩm (productImageBase64).' });
    if (!apiKey) return res.status(401).json({ error: 'Thiếu API key kie.ai. Vui lòng nhập trong cài đặt Picset.' });

    // Coerce missing `category` on legacy blueprints (PATCH §8 backward-compat)
    coerceLegacyCategories({ images });

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
    return res.status(500).json({ error: formatGeminiError(error?.message || 'Internal Server Error') });
  }
}
