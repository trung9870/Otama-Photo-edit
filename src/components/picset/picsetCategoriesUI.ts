// UI-side metadata cho 16 Picset categories.
// Source of truth: api/_lib/picsetCategories.ts (focus blocks chỉ ở backend).
// File này chỉ giữ cn_name + vi_name để hiện badge — KHÔNG copy focus blocks.

export type PicsetCategoryId =
  | 'hero_image'
  | 'core_value'
  | 'lifestyle_scene'
  | 'full_view'
  | 'mood_atmosphere'
  | 'macro_texture'
  | 'brand_story'
  | 'size_reference'
  | 'competitive_advantage'
  | 'spec_table'
  | 'craftsmanship'
  | 'exploded_view'
  | 'full_lineup'
  | 'safety_cert'
  | 'warranty'
  | 'usage_guide';

interface CategoryUIMeta {
  cn_name: string;
  vi_name: string;
  // Density determines badge color tone for visual grouping
  density: 'STANDARD' | 'MINIMAL' | 'HIGH_DENSITY';
}

export const PICSET_CATEGORIES_UI: Record<PicsetCategoryId, CategoryUIMeta> = {
  hero_image:             { cn_name: '视觉开篇', vi_name: 'Thị giác mở màn',     density: 'STANDARD'     },
  core_value:             { cn_name: '价值暴击', vi_name: 'Đánh mạnh giá trị',   density: 'STANDARD'     },
  lifestyle_scene:        { cn_name: '场景沉浸', vi_name: 'Đắm chìm bối cảnh',   density: 'MINIMAL'      },
  full_view:              { cn_name: '全景观感', vi_name: 'Cảm quan toàn cảnh',  density: 'STANDARD'     },
  mood_atmosphere:        { cn_name: '氛围造境', vi_name: 'Tạo dựng không khí',  density: 'STANDARD'     },
  macro_texture:          { cn_name: '质感暴击', vi_name: 'Đánh mạnh chất liệu', density: 'MINIMAL'      },
  brand_story:            { cn_name: '品牌格调', vi_name: 'Phong cách thương hiệu', density: 'STANDARD'  },
  size_reference:         { cn_name: '规格参照', vi_name: 'Tham chiếu kích thước', density: 'STANDARD'   },
  competitive_advantage:  { cn_name: '价值差异', vi_name: 'Khác biệt giá trị',   density: 'STANDARD'     },
  spec_table:             { cn_name: '规格说明', vi_name: 'Thông số kỹ thuật',   density: 'HIGH_DENSITY' },
  craftsmanship:          { cn_name: '匠心工艺', vi_name: 'Nghệ nhân thủ công',  density: 'MINIMAL'      },
  exploded_view:          { cn_name: '配件展示', vi_name: 'Trưng bày phụ kiện',  density: 'STANDARD'     },
  full_lineup:            { cn_name: '全系呈现', vi_name: 'Hiển thị toàn dòng',  density: 'HIGH_DENSITY' },
  safety_cert:            { cn_name: '成分安心', vi_name: 'Thành phần an tâm',   density: 'STANDARD'     },
  warranty:               { cn_name: '无忧保障', vi_name: 'Bảo vệ vô lo',        density: 'STANDARD'     },
  usage_guide:            { cn_name: '使用示意', vi_name: 'Minh họa sử dụng',    density: 'STANDARD'     },
};

export const DENSITY_TONE: Record<CategoryUIMeta['density'], { bg: string; fg: string }> = {
  STANDARD:     { bg: 'rgba(0,122,255,0.15)',  fg: 'var(--color-accent)'  },
  MINIMAL:      { bg: 'rgba(175,82,222,0.15)', fg: '#af52de'              },
  HIGH_DENSITY: { bg: 'rgba(255,149,0,0.15)',  fg: 'var(--color-warning)' },
};

export function isPicsetCategoryId(v: any): v is PicsetCategoryId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PICSET_CATEGORIES_UI, v);
}
