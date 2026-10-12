# IconSax 图标来源与许可

正式插件的功能图标采用用户于 2026-10-13 选定的 A 套：IconSax V1 Bold 实心圆润系列；收藏状态沿用灰色／粉色反馈。

- 用户提供的浏览站点：https://iconsax.dev/
- 图形作者：Vuesax / IconSax。
- 集成来源：`iconsax-reactjs@0.0.8`（https://github.com/rendinjast/iconsax-react），按需提取 Bold 图标的 SVG 路径到 `src/components/PromiIcons.tsx`，保持原始几何，仅继承按钮颜色和尺寸。
- 窗口置顶、拖动手柄、提示词移到顶部、上传、下载、返回顶部、大图关闭使用本项目补充的圆润语义图标。上传／下载使用圆头箭头和底部接收横线，大图关闭是无圆底的叉号。
- 这些图标仅随插件源码和构建集成使用，不作为独立图标包分发。运行时无需访问网站。
- MIT 许可原文：https://github.com/rendinjast/iconsax-react/blob/master/LICENSE
- 构建分发时，`public/licenses/iconsax.txt` 会自动复制到 `dist/licenses/iconsax.txt`，随插件保留许可声明。

## MIT License

Copyright (c) ERFAN KHADIVAR

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
