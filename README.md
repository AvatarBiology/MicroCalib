# 顯微測微器校正練習系統 (Microscope Micrometer Calibration Practice)

![Avatar Biology](https://img.shields.io/badge/Designed_by-Avatar_Biology-fbbf24?style=flat-square) 
![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)

這是一套設計給高中生物學生的「虛擬顯微測微器校正」練習系統，旨在幫助學生透過模擬真實的顯微鏡操作（包含調節輪、載物台平移等），練習如何利用物鏡測微器（Stage Micrometer）來校正目鏡測微器（Ocular Micrometer），並計算出在不同倍率下，目鏡測微器每格所代表的真實長度。

## 🌟 核心功能 (Key Features)

1. **🔬 互動式虛擬顯微鏡操作**
   - **粗細調節輪 (Focus)**：模擬顯微鏡對焦，未對焦時呈現模糊效果。
   - **視野平移 (View X)**：模擬水平移動視野。
   - **載物台移動 (Stage X / Y)**：模擬載物台的微調，幫助學生尋找目鏡與物鏡測微器刻度「完美重疊」的點。

2. **📝 動態生成題庫**
   - 系統自動隨機產生多種放大倍率情境。
   - 使用者需觀察兩尺規重合點，搭配輔助計算工具，求得目鏡測微器每格的真實長度 (μm)。

3. **🏆 達人挑戰機制 (Streak System)**
   - 內建計分機制，連續答對題目可獲得星星標記。
   - 若能順利「連續 5 次正確答題」，即可觸發隱藏的成就獎勵。

4. **📄 動態 PDF 證書匯出**
   - 達成成就後，學生可輸入「班級座號 (5碼)」與「姓名」。
   - 生成精美的《顯微測微器校正達人》專屬證書。
   - 前端直接渲染下載 PDF，檔名自動格式化為 `Certification_班級座號_姓名.pdf`。

## 🛠 技術棧 (Tech Stack)

- **前端框架**: React 18, TypeScript, Vite
- **CSS 框架**: Tailwind CSS
- **動畫**: Framer Motion (`motion/react`)
- **圖標庫**: Lucide React
- **PDF 匯出**: `html2canvas`, `jspdf`
- **外掛配置**: 使用 `vite-plugin-css-injected-by-js` 確保在生產環境匯出時，CSS 樣式正常注入，避免 `html2canvas` 產生截圖跑版現象。
---
*Developed by Avatar Biology (2026)*
