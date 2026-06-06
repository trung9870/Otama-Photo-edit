// PICSET CATEGORIES — 16 Chinese design blocks for Taobao style
// Patch source: PICSET-PATCH-CHINESE-BLOCKS.md §4
//
// LƯU Ý: KHÔNG dịch focus statements / DESIGN_BLOCKS sang tiếng Anh/Việt.
// Tiếng Trung là anchor để Gemini gen ảnh đúng style Taobao.

// ============================================================
// Static blocks
// ============================================================

export const PICSET_HEADER = `帮我给我们这件产品做一个高级感的电商详情页图片,
像山下有松的风格表达售卖详情。`;

export const PICSET_LANGUAGE_VI = `所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`;

export const PICSET_REFERENCE_BRANDS = `参考品牌风格:山下有松、网易严选、MUJI、众诚优品`;

// ============================================================
// 3 density templates
// ============================================================

export const DESIGN_BLOCKS = {
  STANDARD: `重要——这是电商详情页设计图,不是产品摄影:

必须包含以下设计元素:
- 主标题:大号粗体中文标题,2-6个字,放在画面顶部或左上角
- 副标题:中等字号说明文字,补充主标题
- 卖点标签:3-5个小标签或图标,每个配简短文字说明
- 装饰元素:箭头、虚线、圆圈、对话框、徽章中任选2-3种
- 数字强调:如有规格数据,用大号数字突出展示

排版风格:
- 中文字体优雅有质感,字号有明显层次对比
- 采用淘宝/天猫高端店铺的详情页设计美学
- 留白得当,信息密度适中,不要太空也不要太挤
- 文字与产品图自然融合,有商业海报感`,

  MINIMAL: `重要——这是电商详情页设计图,但要保持画面意境:

设计元素需要克制,以画面氛围为主:
- 仅添加1个主标题(大号粗体中文,2-5个字)
- 仅添加1个副标题(简短一句话,补充情绪)
- 不需要卖点标签、不需要装饰元素、不需要数字强调
- 文字放在画面角落,不打扰主体

排版风格:
- 中文字体优雅有诗意,字号克制不张扬
- 采用淘宝/天猫高端生活方式店铺的详情页美学
- 大量留白,信息密度低,以情绪和意境取胜
- 文字像电影海报标题般融入画面`,

  HIGH_DENSITY: `重要——这是电商详情页设计图,信息密度允许较高:

必须包含丰富的设计元素:
- 主标题:大号粗体中文标题,2-6个字
- 副标题:中等字号说明文字,补充主标题
- 数据图表、规格标注、网格展示、对照表等专业图示
- 数字强调:所有规格数据用大号数字突出,配以单位
- 标注线条:从产品各部位引出箭头或细线连接到对应数字
- 装饰元素:几何线条、虚线、刻度尺、色卡条等专业图示

排版风格:
- 中文字体清晰易读,数据字体专业现代
- 采用淘宝/天猫高端店铺规格页的设计美学
- 信息密度较高,允许更多文字和数据展示
- 但仍要保持视觉层次和呼吸感,不能堆砌混乱`,
} as const;

export type DensityKey = keyof typeof DESIGN_BLOCKS;

// ============================================================
// 16 categories
// ============================================================

export const PICSET_CATEGORIES = {
  hero_image: {
    cn_name: '视觉开篇',
    vi_name: 'Thị giác mở màn',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"视觉开篇"——
作为详情页的第一张主图,直击买家眼球,
完美呈现产品最美的角度和最强的视觉吸引力。

视觉上要构图精致、主体突出、画面干净有冲击力,
让买家在第一眼就被吸引并产生点击购买的冲动。`,
  },

  core_value: {
    cn_name: '价值暴击',
    vi_name: 'Đánh mạnh giá trị',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"价值暴击"——
突出展现产品的核心卖点、超值优势和让消费者"哇"的瞬间。

视觉上要冲击力强、对比鲜明、信息层次清晰,
能让买家一眼就感受到这个产品的价值远超价格。`,
  },

  lifestyle_scene: {
    cn_name: '场景沉浸',
    vi_name: 'Đắm chìm bối cảnh',
    density: 'MINIMAL' as DensityKey,
    focus: `只生成一张图片,聚焦于"场景沉浸"——
将产品自然融入真实使用场景中,让买家仿佛身临其境,
感受到产品在生活中的样子和氛围。

视觉上要营造真实的生活气息、温暖的光线和细腻的场景细节,
让买家产生"我也想要这样的生活"的代入感和向往。`,
  },

  full_view: {
    cn_name: '全景观感',
    vi_name: 'Cảm quan toàn cảnh',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"全景观感"——
以宽阔的全景视角完整展现产品的整体形象与细节,
让买家一眼看清产品全貌、质感、工艺和搭配效果。

视觉上要构图大气、画面饱满、细节丰富,
体现产品的完整性、高级感和值得拥有的品质。`,
  },

  mood_atmosphere: {
    cn_name: '氛围造境',
    vi_name: 'Tạo dựng không khí',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"氛围造境"——
通过光线、阴影和色调营造出强烈的情绪氛围,
让产品在特定的mood中呈现出高级感与故事感。

视觉上要善用自然光与柔和阴影、营造温馨/静谧/治愈的情绪,
让买家被画面的氛围打动,产生情感共鸣。`,
  },

  macro_texture: {
    cn_name: '质感暴击',
    vi_name: 'Đánh mạnh chất liệu',
    density: 'MINIMAL' as DensityKey,
    focus: `只生成一张图片,聚焦于"质感暴击"——
以微距特写镜头放大展现面料的纹理、织法、纤维细节,
让买家几乎能"摸到"产品的真实手感。

视觉上要极致清晰、纹理立体、光影细腻,
体现出面料的高级质感、柔软度和工艺品质。`,
  },

  brand_story: {
    cn_name: '品牌格调',
    vi_name: 'Phong cách thương hiệu',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"品牌格调"——
传达品牌的定位、调性和价值观,
让产品超越功能本身,成为一种生活态度的象征。

视觉上要充满质感与艺术感、构图克制有品味、
留白得当且色彩协调,体现品牌的精神内核与高级定位。`,
  },

  size_reference: {
    cn_name: '规格参照',
    vi_name: 'Tham chiếu kích thước',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"规格参照"——
通过将产品与买家熟悉的日常物件并列对比,
让买家直观感受到产品的真实尺寸和比例。

视觉上要构图整洁、对比物清晰可辨、比例真实自然,
让买家瞬间在脑海中建立起产品的实际大小概念。`,
  },

  competitive_advantage: {
    cn_name: '价值差异',
    vi_name: 'Khác biệt giá trị',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"价值差异"——
通过对比展现本产品相对于普通产品或旧款的明显优势,
让买家清晰看到选择本产品的理由。

视觉上要左右对比清晰、差异点突出、信息层次分明,
让买家一眼就能识别出"好"与"普通"的差距。`,
  },

  spec_table: {
    cn_name: '规格说明',
    vi_name: 'Thông số kỹ thuật',
    density: 'HIGH_DENSITY' as DensityKey,
    focus: `只生成一张图片,聚焦于"规格说明"——
以清晰的图表形式展示产品的尺寸、规格、参数信息,
让买家快速理解产品的所有技术细节。

视觉上要排版整洁、数据清晰、图示直观易懂,
体现产品的专业性和品牌的透明诚信。`,
  },

  craftsmanship: {
    cn_name: '匠心工艺',
    vi_name: 'Nghệ nhân thủ công',
    density: 'MINIMAL' as DensityKey,
    focus: `只生成一张图片,聚焦于"匠心工艺"——
通过特写展现产品的制作工艺细节,如缝线、走线、拼接、收边,
让买家感受到背后的匠人精神与品质坚守。

视觉上要近距离精致特写、光线突出工艺细节、质感真实可信,
让买家由内而外认可产品的工艺价值与用心程度。`,
  },

  exploded_view: {
    cn_name: '配件展示',
    vi_name: 'Trưng bày phụ kiện',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"配件展示"——
以爆炸图或平铺方式将套装内所有配件清晰罗列展示,
让买家一目了然这套产品包含哪些组成部分。

视觉上要排列整齐有秩序、每件配件清晰可辨、构图平衡美观,
体现套装的完整性和物超所值的丰富度。`,
  },

  full_lineup: {
    cn_name: '全系呈现',
    vi_name: 'Hiển thị toàn dòng',
    density: 'HIGH_DENSITY' as DensityKey,
    focus: `只生成一张图片,聚焦于"全系呈现"——
将产品的所有颜色、款式、变体以目录形式整齐展示,
让买家轻松浏览并找到最适合自己的款式。

视觉上要排版整齐、色彩协调、每个变体清晰展示,
体现品牌产品线的丰富度和买家的选择自由度。`,
  },

  safety_cert: {
    cn_name: '成分安心',
    vi_name: 'Thành phần an tâm',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"成分安心"——
展示产品获得的健康安全认证、皮肤测试报告、环保资质等,
让买家对产品的安全性和成分放心。

视觉上要权威感强、信息清晰可信、配以认证标识或检测图示,
体现品牌对买家健康的高度重视和负责任的态度。`,
  },

  warranty: {
    cn_name: '无忧保障',
    vi_name: 'Bảo vệ vô lo',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"无忧保障"——
清晰传达品牌的售后政策、质保承诺、退换货保障,
让买家在购买前就感受到无后顾之忧的安心感。

视觉上要值得信赖、信息明确、配以保障图标或承诺图示,
体现品牌对产品质量的自信和对买家的负责承诺。`,
  },

  usage_guide: {
    cn_name: '使用示意',
    vi_name: 'Minh họa sử dụng',
    density: 'STANDARD' as DensityKey,
    focus: `只生成一张图片,聚焦于"使用示意"——
以步骤分解或场景演示的方式展示产品的正确使用、清洁、保养方法,
让买家在购买后能轻松上手并长久使用。

视觉上要步骤清晰、动作直观、配以箭头或编号引导,
让买家通过图片就能完全理解使用方法,降低购买顾虑。`,
  },
} as const;

export type PicsetCategoryId = keyof typeof PICSET_CATEGORIES;

export const PICSET_CATEGORY_IDS: PicsetCategoryId[] = Object.keys(PICSET_CATEGORIES) as PicsetCategoryId[];

// Default fallback ordering for blueprints missing `category` (per PATCH §8)
export const DEFAULT_CATEGORY_ORDER: PicsetCategoryId[] = [
  'hero_image',
  'core_value',
  'lifestyle_scene',
  'full_view',
  'macro_texture',
  'craftsmanship',
  'spec_table',
  'usage_guide',
  'mood_atmosphere',
  'exploded_view',
  'size_reference',
  'competitive_advantage',
  'full_lineup',
  'safety_cert',
  'warranty',
  'brand_story',
];

// ============================================================
// Helpers
// ============================================================

export function isValidPicsetCategory(value: any): value is PicsetCategoryId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PICSET_CATEGORIES, value);
}

/**
 * Build the Chinese design block for a given category.
 * Returns header + focus block + design density block + reference brands.
 * Does NOT include language constraint (added separately in buildFinalPrompt).
 */
export function buildCategoryBlock(category: PicsetCategoryId): string {
  const cat = PICSET_CATEGORIES[category];
  if (!cat) {
    throw new Error(`Unknown Picset category: ${category}`);
  }
  return [
    PICSET_HEADER,
    '',
    cat.focus,
    '',
    DESIGN_BLOCKS[cat.density],
    '',
    PICSET_REFERENCE_BRANDS,
  ].join('\n');
}

/** Pick a fallback category for a slot when AI didn't return one (legacy blueprints). */
export function fallbackCategoryForSlot(slotIdx: number): PicsetCategoryId {
  return DEFAULT_CATEGORY_ORDER[slotIdx % DEFAULT_CATEGORY_ORDER.length];
}
