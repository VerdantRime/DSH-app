# DESIGN.md — DeepSeek工作台 设计系统

本文件按 awesome-design-md 系列的 DESIGN.md 规范格式（colors / typography / rounded / spacing / components）记录设计令牌，供 AI 与开发者保持界面一致。设计语言：蓝白渐变品牌感 + 圆润亲和（贴合应用图标：深蓝渐变长发少女、白色围裙、星点黄）。

## colors（品牌色，提取自应用图标）
- 主蓝 `#4C5F98`（强调色 / 主按钮渐变起点）
- 藏青 `#282F59`（正文 / 标题 / 品牌深部）
- 中蓝 `#38487B`（强调-强 / 渐变收尾）
- 蓝灰 `#6A83A8`（弱化文字）
- 星点黄 `#F5C84C`（图标星星点缀色，预留 token --brand-star）
- 浅色主题：背景 `#F5F7FB`，卡片 `#FFFFFF`，边框 `#E3E7F2`，悬停 `#EEF1F9`，强调底 `#EDF0F9`
- 深色主题：背景 `#14172B`，卡片 `#1A1E39`，边框 `#2A3156`，悬停 `#222844`
- 语义色：成功 `#2ea043`，警告 `#d29922`，错误 `#cf222e`

## rounded（圆角令牌，CSS 变量 --radius-*）
- xs `4px` · sm `6px` · md `8px`（按钮/输入框） · lg `12px`（卡片） · xl `16px` · pill `9999px`

## spacing（间距令牌，4px 基准，CSS 变量 --space-*）
- 1 `4px` · 2 `8px` · 3 `12px` · 4 `16px` · 5 `24px` · 6 `32px`

## typography
- 界面字体：Segoe UI / PingFang SC / Microsoft YaHei / system-ui
- 导航项 13px/600，按钮 12px/600，标题 13-14px/700，正文 13-14px，辅助 12px
- 代码字体：Consolas / monospace

## components
- button：md 圆角、6×14px 内边距、浅阴影；主操作 `.btn.primary` 使用品牌蓝渐变（#4C5F98→#38487B）白字
- nav-item：md 圆角；激活态品牌蓝渐变底 + 白字
- gh-card / set-section：lg 圆角卡片、1px 发丝边框、hover 抬升 1px（transform）
- gh-file-row：SVG 文件夹/文件图标（currentColor）+ 名称 + 右侧文件大小
- gh-readme：GitHub 风格 Markdown 网页渲染（标题分隔线、代码块、表格、引用）
- sidebar-brand：应用图标（圆角 md）+ 名称 + 副标语「Ciallo~」

## motion
- 只用 transform/opacity（GPU 友好）；面板入场 panel-in 180ms；尊重 prefers-reduced-motion

## 深色模式
- 通过 `[data-theme='dark']` 切换，藏青底 + 浅色文字 + 雾蓝强调
