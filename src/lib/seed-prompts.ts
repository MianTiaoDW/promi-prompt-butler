import type { PromptGroup } from "../types/prompt";

export interface DefaultPromptSeed {
  id: string;
  title: string;
  group: PromptGroup;
}

export const DEFAULT_PROMPT_SEEDS: DefaultPromptSeed[] = [
  {
    id: "seed-promi-line-and-color-draft",
    title: "图像转线稿&色稿",
    group: {
      notes: "",
      steps: [
        {
          name: "转线稿",
          content: "把原图转化为干净流畅的纯线稿，仅保留黑白两色;确保黑白层次清晰、色彩关系明确，去除多余杂色与渐变，画面不要有饱和度"
        },
        {
          name: "转白模",
          content: "将 {{Image 1}} 转换为纯白膜稿/white model/clay render风格。保留原始物体的结构、轮廓、比例与体块关系,仅通过白色、灰白色和极浅的明暗层次表现体积、空间与结构转折。画面应干净统一,整体无彩色信息、无饱和度、无材质贴图、无复杂纹理里、无杂色渐变、无明显环境光色偏。去除原图中的颜色、图案、反射与装饰性材质,只保留简洁柔和的光影分层,使其呈现类似白色石膏模型或数字雕塑灰模渲染的效果。"
        },
        {
          name: "倒推生图提示词话术(给对话型AI用)",
          content: "给我生成这张图片的整段中文提示词"
        },
        {
          name: "生图前必加的提示词",
          content: "请你根据以下提示词,还原 {{Image 1}} 白膜/线稿,并且根据 {{Image 2}} 物体固有色进行上色,最后生成图片：（这里输入上一步反推出来的中文提示词）"
        }
      ]
    }
  },
  {
    id: "seed-promi-hd-restore-3d",
    title: "高清修复(3D视觉)",
    group: {
      notes: "",
      steps: [{
        name: "",
        content: `基础修复: "提升 3D 模型质量,恢复细节纹理,增强清晰度,提高分辨率。修复模型边缘,确保边缘干净清晰。优化面数分布,保持原有比例。修复模型缺陷,如穿插、重叠、空洞。保持原有造型和设计元素不变。"

纹理修复: "恢复纹理细节,增强清晰度。修复纹理模糊或失真区域。保持原有材质属性(光泽、粗糙度、透明度)。优化 UV 映射,确保纹理正确贴合。"

色彩修复: "保持原有色彩方案不变。修复色彩失真或褪色区域。优化光影效果,增强立体感。保持原始光照和阴影效果。"

人物修复: "严格保持人物面部特征、五官比例不变。保留原有发型、服装、配饰细节。保持动作姿态和表情不变。修复模糊区域,但不改变形象。"

完整修复: "提升 3D 模型质量,恢复细节纹理,增强清晰度,提高分辨率。修复模型边缘,确保边缘干净清晰。优化面数分布,保持原有比例。修复模型缺陷,如穿插、重叠、空洞。保持原有造型和设计元素不变。恢复纹理细节,增强清晰度。修复纹理模糊或失真区域。保持原有材质属性。保持原有色彩方案不变。修复色彩失真或褪色区域。优化光影效果,增强立体感。严格保持人物面部特征、五官比例不变。保留原有发型、服装、配饰细节。保持动作姿态和表情不变。修复模糊区域,但不改变形象。"`
      }]
    }
  },
  {
    id: "seed-promi-cg-render-general",
    title: "CG渲染(通用)",
    group: {
      notes: "",
      steps: [{
        name: "",
        content: `请你根据以下提示词，还原图片1线稿，并且根据图片2物体固有色进行上色，最后生成图片:

1、主体
将原始插画重新打造为 高端专业级3D渲染作品。完整保留原始构图、角色关系与核心概念表达，不改变原始视觉逻辑，不进行简化，不将场景常规化。最终画面需呈现为 高品质超现实3D艺术作品，达到 专业CGI工作室级制作水准。

2、角色结构
保持原始角色的整体造型结构与设计语言。角色需具备清晰的体块关系、真实的空间体积感与稳定的结构逻辑。
自动检测并修复人物结构错误，包括但不限于：
六指或多指问题、肢体数量异常、身体比例畸变、解剖结构错误，确保角色结构符合 现实生理逻辑与空间结构，无任何视觉bug。

3、比例
角色比例需保持稳定与合理：
符合自然人体比例或设计比例逻辑、四肢长度与关节位置正确、身体结构平衡稳定、头身比与角色设计保持一致，在修复比例时，必须保持原始设计风格与角色气质，避免破坏原始创作意图。

4、造型
使用干净且写实的几何造型构建角色与场景。
关键区域需具备高多边形细节表现：
面部结构、手部结构、服装褶皱关键装饰元素
避免：
低模建模、风格化简化、模糊结构，整体造型需具有真实体积感与结构层次。

5、材质
使用 PBR（Physically Based Rendering）材质系统。
材质需具备：
真实表面粗糙度（Roughness）、合理的光泽度（Specular）、微观纹理细节（Micro Surface Detail）、自然反射与折射效果、毛发部分需要是真实毛发的质感
特殊材质需呈现真实物理属性：
半透明材质（Subsurface Scattering）、金属反射、玻璃折射、真实表面磨损或纹理变化
避免：
平涂材质、塑料感表面、无细节贴图

6、渲染
采用超精细3D渲染与物理真实光照系统：
基于物理的渲染（PBR Rendering）、写实全局光照（Global Illumination）、光线反弹（Light Bounce）、高动态范围光照（HDR Lighting）
阴影表现需：
干净自然、过渡柔和、与光源逻辑一致、整体画面需达到高端CGI级渲染质量。

7、灯光
使用电影级布光逻辑：
柔和定向主光（Key Light）、控制对比度的辅助光（Fill Light）、精细轮廓光 / 边缘光（Rim Light）
强调：
物体体积感、空间层次、视觉焦点
可使用：
写实景深（Depth of Field）、强烈空间纵深感、层次叠加的空间关系
避免：
均匀化布光、平涂式照明

8、风格
整体风格为高品质超现实3D视觉风格。
画面需具备：
强烈空间层次、实体体积感、超现实视觉张力
超现实元素要求：
悬浮元素保持真实悬浮状态、无可见支撑结构、保持物理实体感
避免：
插画风格表现、矢量轮廓线、手绘纹理、图形化平涂色彩`
      }]
    }
  },
  {
    id: "seed-promi-plush-render",
    title: "毛绒玩具渲染",
    group: {
      notes: "",
      steps: [{
        name: "",
        content: `请你根据以下提示词，还原图片1线稿，并且根据图片2物体固有色进行上色，最后生成图片:
根据输入图像进行生成：
结构约束：
严格还原图片1的线稿结构，保持角色的轮廓、比例、五官位置及造型特征，不进行大幅度改动，不偏离原始设计。

上色逻辑：
参考图片2的物体固有色进行上色，遵循其配色关系与色彩分布，保证颜色自然统一，不出现随机配色或偏色。

材质设定（重点）：
将整体对象转化为高质量毛绒玩具材质（plush toy material），表现出：
水晶超柔毛绒材质，超短绒高密度纤维，表面细腻顺滑且均匀，无明显纤维颗粒感，绒毛紧密贴合，具有轻微柔和反光（sheen）而非强高光，光影过渡自然柔软，呈现干净高级的织物质感，绒面带有细微顺毛方向与轻微刷痕效果，局部有轻微压缩质感，整体柔软蓬松但结构紧实，真实毛绒玩具面料表现，产品级写实效果，避免长毛、避免杂乱毛发、避免塑料感、避免过度哑光、避免噪点纹理

渲染表现：
高质量三维渲染（high quality 3D render）
柔和光照（soft lighting）
干净背景（clean background）
产品级展示效果（product-style rendering）

约束条件：
避免出现：
塑料感 / 橡胶感材质
过度光滑表面
结构变形
颜色偏移`
      }]
    }
  },
  {
    id: "seed-promi-hd-restore-realistic",
    title: "高清修复(写实场景)",
    group: {
      notes: "",
      steps: [{
        name: "",
        content: `提升图像质量，恢复细节，增强清晰度，
提高分辨率，边缘干净清晰，纹理明确，
保持原有设计与比例结构不变，
维持材质真实感
避免模糊，避免过度平滑，避免风格发生变化`
      }]
    }
  },
  {
    id: "seed-promi-image2-clean",
    title: "image2生图去油腻",
    group: {
      notes: "",
      steps: [
        {
          name: "画面质感去油去污",
          content: "整体画面必须干净、平滑、统一，强调大色块叙事与整体轮廓，边缘清晰利落，表面干净，画面颜色通透，画面呼吸感强；大幅度减少模型表面的纹理细节；还原真实的C4D渲染质感，Octane渲染质感，超写实纹理表面，光线追踪，UnrealEngine5渲染引擎质感，高精度贴图；"
        },
        {
          name: "反向提示词，减少杂乱",
          content: "不要细碎噪点，不要高频纹理，不要脏污颗粒，不要密集小装饰；禁止出现非常多的细节，禁止出现超高解析度，禁止出现细节过分的锐化，禁止出现过高的饱和度；禁止出现文字；"
        },
        {
          name: "风格提示词·3D卡通",
          content: "3D卡通渲染，Q版萌系风格，圆润无棱角设计，次世代PBR精致渲染，治愈欢乐氛围，活力热闹质感，亲和力强，细腻材质表现；高质量的互联网商业KV海报"
        }
      ]
    }
  }
];

// Retired built-in IDs retained only to clean up previously installed libraries.
export const RETIRED_SEED_IDS = new Set<string>([
  "seed-bwc-core-1",
  "seed-bwc-core-2",
  "seed-bwc-core-3",
  "seed-bwc-core-4",
  "seed-bwc-hot-001",
  "seed-bwc-hot-002",
  "seed-bwc-hot-003",
  "seed-bwc-hot-004",
  "seed-bwc-hot-005",
  "seed-bwc-hot-006",
  "seed-bwc-hot-007",
  "seed-bwc-hot-008",
  "seed-bwc-hot-009",
  "seed-bwc-hot-010",
  "seed-bwc-hot-011",
  "seed-bwc-hot-012",
  "seed-bwc-hot-013",
  "seed-bwc-hot-014",
  "seed-bwc-hot-015",
  "seed-bwc-hot-016",
  "seed-bwc-hot-017",
  "seed-bwc-hot-018",
  "seed-bwc-hot-019",
  "seed-bwc-hot-020",
  "seed-bwc-hot-021",
  "seed-bwc-hot-022",
  "seed-bwc-hot-023",
  "seed-bwc-hot-024",
  "seed-bwc-hot-025",
  "seed-bwc-hot-026",
  "seed-bwc-hot-027",
  "seed-bwc-hot-028",
  "seed-bwc-hot-029",
  "seed-bwc-hot-030",
  "seed-bwc-hot-031",
  "seed-bwc-hot-032",
  "seed-bwc-hot-033",
  "seed-bwc-hot-034",
  "seed-bwc-hot-035",
  "seed-bwc-hot-036",
  "seed-bwc-hot-037",
  "seed-bwc-hot-038",
  "seed-bwc-hot-039",
  "seed-bwc-hot-040",
  "seed-bwc-hot-041",
  "seed-bwc-hot-042",
  "seed-bwc-hot-043",
  "seed-bwc-hot-044",
  "seed-bwc-hot-045",
  "seed-bwc-hot-046",
  "seed-bwc-hot-047",
  "seed-bwc-hot-048",
  "seed-bwc-hot-049",
  "seed-bwc-hot-050",
  "seed-bwc-hot-051",
  "seed-bwc-hot-052",
  "seed-bwc-hot-053",
  "seed-bwc-hot-054",
  "seed-bwc-hot-055",
  "seed-bwc-hot-056",
  "seed-bwc-hot-057",
  "seed-bwc-hot-058",
  "seed-bwc-hot-059",
  "seed-bwc-hot-060",
  "seed-bwc-hot-061",
  "seed-bwc-hot-062",
  "seed-bwc-hot-063",
  "seed-bwc-hot-064",
  "seed-bwc-hot-065",
  "seed-bwc-hot-066",
  "seed-bwc-hot-067",
  "seed-bwc-hot-068",
  "seed-bwc-hot-069",
  "seed-bwc-hot-070",
  "seed-bwc-hot-071",
  "seed-bwc-hot-072",
  "seed-bwc-hot-073",
  "seed-bwc-hot-074",
  "seed-bwc-hot-075",
  "seed-bwc-hot-076",
  "seed-bwc-hot-077",
  "seed-bwc-hot-078",
  "seed-bwc-hot-079",
  "seed-bwc-hot-080",
  "seed-bwc-hot-081",
  "seed-bwc-hot-082",
  "seed-bwc-hot-083",
  "seed-bwc-hot-084",
  "seed-bwc-hot-085",
  "seed-bwc-hot-086",
  "seed-bwc-hot-087",
  "seed-bwc-hot-088",
  "seed-bwc-hot-089",
  "seed-bwc-hot-090",
  "seed-bwc-hot-091",
  "seed-bwc-hot-092",
  "seed-bwc-hot-093",
  "seed-bwc-hot-094",
  "seed-bwc-hot-095",
  "seed-bwc-hot-096",
  "seed-bwc-hot-097",
  "seed-bwc-hot-098",
  "seed-bwc-hot-099",
  "seed-bwc-hot-100",
  "seed-bwc-hot-101",
  "seed-bwc-hot-102",
  "seed-bwc-hot-103",
  "seed-bwc-hot-104",
  "seed-bwc-hot-105",
  "seed-bwc-hot-106",
  "seed-bwc-hot-107",
  "seed-bwc-hot-108",
  "seed-bwc-hot-109",
  "seed-bwc-hot-110",
  "seed-bwc-hot-111",
  "seed-bwc-hot-112",
  "seed-bwc-hot-113",
  "seed-bwc-hot-114",
  "seed-bwc-hot-115",
  "seed-bwc-hot-116",
  "seed-bwc-hot-117",
  "seed-bwc-hot-118",
  "seed-bwc-hot-119",
  "seed-bwc-hot-120",
  "seed-bwc-hot-121",
  "seed-bwc-hot-122",
  "seed-bwc-hot-123",
  "seed-bwc-hot-124",
  "seed-bwc-hot-125",
  "seed-bwc-hot-126",
  "seed-bwc-hot-127",
  "seed-bwc-hot-128",
  "seed-bwc-hot-129",
  "seed-bwc-hot-130",
  "seed-bwc-hot-131",
  "seed-bwc-hot-132",
  "seed-bwc-hot-133",
  "seed-bwc-hot-134",
  "seed-bwc-hot-135",
  "seed-bwc-hot-136",
  "seed-bwc-hot-137",
  "seed-bwc-hot-138",
  "seed-bwc-hot-139",
  "seed-bwc-hot-140",
  "seed-bwc-hot-141",
  "seed-bwc-hot-142",
  "seed-bwc-hot-143",
  "seed-bwc-hot-144",
  "seed-bwc-hot-145",
  "seed-bwc-hot-146",
  "seed-bwc-hot-147",
  "seed-bwc-hot-148",
  "seed-bwc-hot-149",
  "seed-bwc-hot-150",
  "seed-bwc-hot-151",
  "seed-bwc-hot-152",
  "seed-bwc-hot-153",
  "seed-bwc-hot-154",
  "seed-bwc-hot-155",
  "seed-bwc-pdf-001",
  "seed-bwc-pdf-002",
  "seed-bwc-pdf-003",
  "seed-bwc-pdf-004",
  "seed-bwc-pdf-005",
  "seed-bwc-pdf-006",
  "seed-bwc-pdf-007",
  "seed-bwc-pdf-008",
  "seed-bwc-pdf-009",
  "seed-bwc-pdf-010",
  "seed-bwc-pdf-011",
  "seed-bwc-pdf-012",
  "seed-bwc-pdf-013",
  "seed-bwc-pdf-014",
  "seed-bwc-pdf-015",
  "seed-bwc-pdf-016",
  "seed-bwc-pdf-017",
  "seed-bwc-pdf-018",
  "seed-bwc-pdf-019",
  "seed-bwc-pdf-020",
  "seed-bwc-pdf-021",
  "seed-bwc-pdf-022",
  "seed-bwc-pdf-023",
  "seed-bwc-pdf-024",
  "seed-bwc-pdf-025",
  "seed-bwc-pdf-026",
  "seed-bwc-pdf-027",
]);
