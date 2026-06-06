// 16 prompt mẫu cho OFA — TMĐT detail page theo phong cách Taobao/Tmall cao cấp.
// Nguồn: otama-ecom-prompt-library_1.md
// Trong UI, người dùng nhập tên sản phẩm + mô tả bổ sung → ghép vào trước/sau prompt mẫu.

export interface OfaPromptCategory {
  id: number;
  code: string;        // mã ngắn để log usage
  name: string;        // tên VN
  cn: string;          // tiêu đề CN
  density: 'Minimal' | 'Standard' | 'High Density';
  recommendedModel: 'gpt2' | 'banana-pro' | 'both';
  prompt: string;
}

const COMMON_DESIGN_BLOCK = `必须包含以下设计元素:
- 主标题:大号粗体中文标题,2-6个字,放在画面顶部或左上角
- 副标题:中等字号说明文字,补充主标题
- 卖点标签:3-5个小标签或图标,每个配简短文字说明
- 装饰元素:箭头、虚线、圆圈、对话框、徽章中任选2-3种
- 数字强调:如有规格数据,用大号数字突出展示

排版风格:
- 中文字体优雅有质感,字号有明显层次对比
- 采用淘宝/天猫高端店铺的详情页设计美学
- 留白得当,信息密度适中,不要太空也不要太挤
- 文字与产品图自然融合,有商业海报感

参考品牌风格:山下有松、网易严选、MUJI、众诚优品

所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`;

const PREFIX = `帮我给我们这件产品做一个高级感的电商详情页图片,
像山下有松的风格表达售卖详情。`;

export const OFA_PROMPT_LIBRARY: OfaPromptCategory[] = [
  {
    id: 1, code: 'hero', name: 'Thị giác mở màn', cn: '视觉开篇',
    density: 'Standard', recommendedModel: 'both',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"视觉开篇"——
作为详情页的第一张主图,直击买家眼球,
完美呈现产品最美的角度和最强的视觉吸引力。

视觉上要构图精致、主体突出、画面干净有冲击力,
让买家在第一眼就被吸引并产生点击购买的冲动。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 2, code: 'value', name: 'Đánh mạnh giá trị', cn: '价值暴击',
    density: 'Standard', recommendedModel: 'gpt2',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"价值暴击"——
突出展现产品的核心卖点、超值优势和让消费者"哇"的瞬间。

视觉上要冲击力强、对比鲜明、信息层次清晰,
能让买家一眼就感受到这个产品的价值远超价格。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 3, code: 'scene', name: 'Đắm chìm bối cảnh', cn: '场景沉浸',
    density: 'Minimal', recommendedModel: 'banana-pro',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"场景沉浸"——
将产品自然融入真实使用场景中,让买家仿佛身临其境,
感受到产品在生活中的样子和氛围。

视觉上要营造真实的生活气息、温暖的光线和细腻的场景细节,
让买家产生"我也想要这样的生活"的代入感和向往。

重要——这是电商详情页设计图,但要保持画面意境:

设计元素需要克制,以画面氛围为主:
- 仅添加1个主标题(大号粗体中文,2-5个字)
- 仅添加1个副标题(简短一句话,补充情绪)
- 不需要卖点标签、不需要装饰元素、不需要数字强调
- 文字放在画面角落,不打扰主体场景

排版风格:
- 中文字体优雅有诗意,字号克制不张扬
- 采用淘宝/天猫高端生活方式店铺的详情页美学
- 大量留白,信息密度低,以情绪和意境取胜
- 文字像电影海报标题般融入画面

参考品牌风格:山下有松、网易严选、MUJI、众诚优品

所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`,
  },
  {
    id: 4, code: 'fullview', name: 'Cảm quan toàn cảnh', cn: '全景观感',
    density: 'Standard', recommendedModel: 'banana-pro',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"全景观感"——
以宽阔的全景视角完整展现产品的整体形象与细节,
让买家一眼看清产品全貌、质感、工艺和搭配效果。

视觉上要构图大气、画面饱满、细节丰富,
体现产品的完整性、高级感和值得拥有的品质。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 5, code: 'mood', name: 'Tạo dựng không khí', cn: '氛围造境',
    density: 'Standard', recommendedModel: 'banana-pro',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"氛围造境"——
通过光线、阴影和色调营造出强烈的情绪氛围,
让产品在特定的mood中呈现出高级感与故事感。

视觉上要善用自然光与柔和阴影、营造温馨/静谧/治愈的情绪,
让买家被画面的氛围打动,产生情感共鸣。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 6, code: 'texture', name: 'Đánh mạnh chất liệu', cn: '质感暴击',
    density: 'Minimal', recommendedModel: 'banana-pro',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"质感暴击"——
以微距特写镜头放大展现面料的纹理、织法、纤维细节,
让买家几乎能"摸到"产品的真实手感。

视觉上要极致清晰、纹理立体、光影细腻,
体现出面料的高级质感、柔软度和工艺品质。

重要——这是电商详情页设计图,但要让纹理细节占主角:

设计元素需要极简,不抢夺面料特写的注意力:
- 主标题:简短有力的中文标题,3-4个字,放在画面一角
- 副标题:简短的一句话说明,描述面料特性
- 卖点标签:最多1-2个小标签或图标,标注关键工艺词
- 不需要装饰元素如箭头对话框
- 数字可以有但要克制,例如克重、支数

排版风格:
- 中文字体精致考究,字号小而有力
- 采用淘宝/天猫面料高端店铺的详情页美学
- 大量留白,让纹理特写自然呼吸
- 文字像精品商品标签般低调融入

参考品牌风格:山下有松、网易严选、MUJI、众诚优品

所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`,
  },
  {
    id: 7, code: 'brand', name: 'Phong cách thương hiệu', cn: '品牌格调',
    density: 'Standard', recommendedModel: 'banana-pro',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"品牌格调"——
传达品牌的定位、调性和价值观,
让产品超越功能本身,成为一种生活态度的象征。

视觉上要充满质感与艺术感、构图克制有品味、
留白得当且色彩协调,体现品牌的精神内核与高级定位。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 8, code: 'size', name: 'Tham chiếu kích thước', cn: '规格参照',
    density: 'Standard', recommendedModel: 'gpt2',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"规格参照"——
通过将产品与买家熟悉的日常物件并列对比,
让买家直观感受到产品的真实尺寸和比例。

视觉上要构图整洁、对比物清晰可辨、比例真实自然,
让买家瞬间在脑海中建立起产品的实际大小概念。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 9, code: 'compare', name: 'Khác biệt giá trị', cn: '价值差异',
    density: 'Standard', recommendedModel: 'gpt2',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"价值差异"——
通过对比展现本产品相对于普通产品或旧款的明显优势,
让买家清晰看到选择本产品的理由。

视觉上要左右对比清晰、差异点突出、信息层次分明,
让买家一眼就能识别出"好"与"普通"的差距。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 10, code: 'spec', name: 'Thông số kỹ thuật', cn: '规格说明',
    density: 'High Density', recommendedModel: 'gpt2',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"规格说明"——
以清晰的图表形式展示产品的尺寸、规格、参数信息,
让买家快速理解产品的所有技术细节。

视觉上要排版整洁、数据清晰、图示直观易懂,
体现产品的专业性和品牌的透明诚信。

重要——这是电商详情页设计图,信息密度允许较高:

必须包含丰富的设计元素:
- 主标题:大号粗体中文标题,2-6个字
- 副标题:中等字号说明文字,补充主标题
- 数据图表:产品轮廓示意图配上各部位尺寸标注
- 数字强调:所有规格数据用大号数字突出,配以单位(cm/kg等)
- 标注线条:从产品各部位引出箭头或细线连接到对应数字
- 信息表格:可以有简洁的参数对照表
- 装饰元素:几何线条、虚线、刻度尺等专业图示

排版风格:
- 中文字体清晰易读,数据字体专业现代
- 采用淘宝/天猫高端店铺规格页的设计美学
- 信息密度较高,允许更多文字和数据展示
- 但仍要保持视觉层次和呼吸感,不能堆砌混乱

参考品牌风格:山下有松、网易严选、MUJI、众诚优品

所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`,
  },
  {
    id: 11, code: 'craft', name: 'Nghệ nhân thủ công', cn: '匠心工艺',
    density: 'Minimal', recommendedModel: 'banana-pro',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"匠心工艺"——
通过特写展现产品的制作工艺细节,如缝线、走线、拼接、收边,
让买家感受到背后的匠人精神与品质坚守。

视觉上要近距离精致特写、光线突出工艺细节、质感真实可信,
让买家由内而外认可产品的工艺价值与用心程度。

重要——这是电商详情页设计图,但要让工艺细节占主角:

设计元素需要极简,不抢夺工艺特写的注意力:
- 主标题:简短有力的中文标题,3-4个字,例如"匠心工艺"、"细节见品质"
- 副标题:简短的一句话说明,描述工艺亮点
- 卖点标签:最多1-2个小标签或图标,标注关键工艺细节
- 不需要装饰元素如对话框徽章
- 可有引导线从工艺部位引出到说明文字

排版风格:
- 中文字体精致考究,字号小而有力
- 采用淘宝/天猫工艺品高端店铺的详情页美学
- 大量留白,让工艺特写自然呼吸
- 文字像匠人签名般低调内敛

参考品牌风格:山下有松、网易严选、MUJI、众诚优品

所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`,
  },
  {
    id: 12, code: 'accessories', name: 'Trưng bày phụ kiện', cn: '配件展示',
    density: 'Standard', recommendedModel: 'both',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"配件展示"——
以爆炸图或平铺方式将套装内所有配件清晰罗列展示,
让买家一目了然这套产品包含哪些组成部分。

视觉上要排列整齐有秩序、每件配件清晰可辨、构图平衡美观,
体现套装的完整性和物超所值的丰富度。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 13, code: 'lineup', name: 'Hiển thị toàn dòng', cn: '全系呈现',
    density: 'High Density', recommendedModel: 'gpt2',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"全系呈现"——
将产品的所有颜色、款式、变体以目录形式整齐展示,
让买家轻松浏览并找到最适合自己的款式。

视觉上要排版整齐、色彩协调、每个变体清晰展示,
体现品牌产品线的丰富度和买家的选择自由度。

重要——这是电商详情页设计图,信息密度允许较高:

必须包含丰富的设计元素:
- 主标题:大号粗体中文标题,2-6个字,例如"全色系"、"任你挑"
- 副标题:中等字号说明文字,例如"X 款配色 自由搭配"
- 网格展示:产品的每个颜色/款式按网格整齐排列(3x2、4x2、3x3等)
- 颜色标签:每个变体下方配以颜色名称的小标签
- 编号标注:可以给每个变体编号(01/02/03...)
- 装饰元素:几何分隔线、色卡条、变体框等

排版风格:
- 中文字体清晰易读,字号有明显层次
- 采用淘宝/天猫服装家居店铺色卡页的设计美学
- 信息密度较高,允许更多文字和数据展示
- 但仍要保持视觉层次和秩序感,不能凌乱

参考品牌风格:山下有松、网易严选、MUJI、众诚优品

所有文字必须使用越南语 (Vietnamese),
完整保留所有声调符号: ô ồ ậ ữ ằ ọ ợ ớ ấ ầ ế ề ể ễ ệ ơ ờ ở ư ừ ử đ Đ
不要直译,要用越南电商的自然表达方式`,
  },
  {
    id: 14, code: 'safety', name: 'Thành phần an tâm', cn: '成分安心',
    density: 'Standard', recommendedModel: 'gpt2',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"成分安心"——
展示产品获得的健康安全认证、皮肤测试报告、环保资质等,
让买家对产品的安全性和成分放心。

视觉上要权威感强、信息清晰可信、配以认证标识或检测图示,
体现品牌对买家健康的高度重视和负责任的态度。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 15, code: 'warranty', name: 'Bảo vệ vô lo', cn: '无忧保障',
    density: 'Standard', recommendedModel: 'gpt2',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"无忧保障"——
清晰传达品牌的售后政策、质保承诺、退换货保障,
让买家在购买前就感受到无后顾之忧的安心感。

视觉上要值得信赖、信息明确、配以保障图标或承诺图示,
体现品牌对产品质量的自信和对买家的负责承诺。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
  {
    id: 16, code: 'usage', name: 'Minh họa sử dụng', cn: '使用示意',
    density: 'Standard', recommendedModel: 'both',
    prompt: `${PREFIX}

只生成一张图片,聚焦于"使用示意"——
以步骤分解或场景演示的方式展示产品的正确使用、清洁、保养方法,
让买家在购买后能轻松上手并长久使用。

视觉上要步骤清晰、动作直观、配以箭头或编号引导,
让买家通过图片就能完全理解使用方法,降低购买顾虑。

重要——这是电商详情页设计图,不是产品摄影:

${COMMON_DESIGN_BLOCK}`,
  },
];

// Build the final prompt sent to the API.
// Inject product name + optional description so AI knows what the product is.
export function buildOfaPrompt(category: OfaPromptCategory, productName: string, description?: string): string {
  const productLine = `产品名称: ${productName.trim()}`;
  const descLine = description?.trim() ? `\n产品卖点/补充说明: ${description.trim()}` : '';
  return `${productLine}${descLine}\n\n${category.prompt}`;
}
