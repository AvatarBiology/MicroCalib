import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle2, XCircle, RefreshCw, HelpCircle, ChevronRight, Calculator, Award, Star, Download, Flame, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// 1 Stage Division is standard 0.01mm = 10um
const STAGE_DIV_UM = 10;
const OCULAR_MAX_LINES = 100;
const OCULAR_LINE_SPACING = 12; // Base visual purely for SVG rendering

type ProblemConfig = {
  sRatio: number;      // equivalent Stage divisions
  oRatio: number;      // equivalent Ocular divisions
  alignOcular: number; // The line index on Ocular that aligns
  alignStage: number;  // The line index on Stage that aligns
  answer: number;      // Exact answer in um
  id: string;          // Unique ID to trigger re-renders
};

const SCENARIOS = [
  { s: 1, o: 10 },   // 1 um/div (100x)
  { s: 1, o: 4 },    // 2.5 um/div (40x approx)
  { s: 2, o: 5 },    // 4 um/div
  { s: 3, o: 10 },   // 3 um/div
  { s: 1, o: 1 },    // 10 um/div (10x approx)
  { s: 4, o: 25 },   // 1.6 um/div
  { s: 7, o: 30 },   // ~2.33 um/div
  { s: 3, o: 8 },    // 3.75 um/div
  { s: 5, o: 20 },   // 2.5 um/div
  { s: 10, o: 100 }  // 1 um/div extreme case
];

// Helper to generate a new problem
const generateProblem = (): ProblemConfig => {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  
  // Pick a random alignment point that ensures we can see at least one other alignment point
  // Ocular is typically 0-100.
  // We want the alignment to be somewhere reasonably central to allow finding the next overlap.
  const alignOcular = Math.floor(Math.random() * 40) + 10;
  const alignStage = Math.floor(Math.random() * 30) + 10;

  const answer = (scenario.s * STAGE_DIV_UM) / scenario.o;

  return {
    sRatio: scenario.s,
    oRatio: scenario.o,
    alignOcular,
    alignStage,
    answer,
    id: Math.random().toString(36).substring(7),
  };
};

export default function MicrometerPractice() {
  const [problem, setProblem] = useState<ProblemConfig | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [stageDivInput, setStageDivInput] = useState('');
  const [ocularDivInput, setOcularDivInput] = useState('');
  
  const [streak, setStreak] = useState(0);
  const [showCertificateForm, setShowCertificateForm] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);
  
  // Microscope Control States
  const [viewX, setViewX] = useState(0);
  const [stageX, setStageX] = useState(0);
  const [stageY, setStageY] = useState(0);
  const [focusLevel, setFocusLevel] = useState(50);
  const blurAmount = Math.abs(focusLevel - 50) * 0.15;

  useEffect(() => {
    initNewProblem();
  }, []);

  const initNewProblem = () => {
    setProblem(generateProblem());
    setUserAnswer('');
    setFeedback(null);
    setShowHint(false);
    setStageDivInput('');
    setOcularDivInput('');
    
    // Reset controls
    setViewX(0);
    setStageX(0);
    setStageY(0);
    // Randomize initial focus level so they have to adjust it
    setFocusLevel(Math.random() > 0.5 ? Math.floor(Math.random() * 25) : Math.floor(75 + Math.random() * 25));
  };

  const handleCheckAnswer = () => {
    if (!problem) return;
    const numericAnswer = parseFloat(userAnswer);
    if (isNaN(numericAnswer)) {
      alert("請輸入有效的數字 (Please enter a valid number)");
      return;
    }

    // Allow a small margin of error for rounding (e.g. 0.01)
    const margin = 0.02;
    if (Math.abs(numericAnswer - problem.answer) <= margin) {
      if (feedback !== 'correct') {
        setStreak(prev => prev + 1);
      }
      setFeedback('correct');
    } else {
      if (feedback !== 'incorrect') {
        setStreak(0);
      }
      setFeedback('incorrect');
    }
  };

  const handleDownloadPdf = async () => {
    if (!certificateRef.current) return;
    setIsPdfGenerating(true);
    try {
      // Add useCORS and allowTaint to support rendering lucide icons and complex styles
      const canvas = await html2canvas(certificateRef.current, { 
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#faf9f6'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Certification_${studentId}_${studentName}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("證書產製失敗，請重試！ (" + (err instanceof Error ? err.message : String(err)) + ")");
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheckAnswer();
  };

  if (!problem) return null;

  // --- SVG Calculation Logic ---
  const SVG_WIDTH = Math.max(1000, OCULAR_MAX_LINES * OCULAR_LINE_SPACING + 200);
  const SVG_HEIGHT = 260;
  const CENTER_Y = SVG_HEIGHT / 2;
  const GAP = 30; // Gap between ocular and stage scales

  const stageLineSpacing = OCULAR_LINE_SPACING * (problem.oRatio / problem.sRatio);
  const OFFSET_X = 50; 
  
  // Calculate Base X for Stage so that alignStage perfectly matches alignOcular
  const alignedXPos = OFFSET_X + problem.alignOcular * OCULAR_LINE_SPACING;
  const baseStageX = alignedXPos - problem.alignStage * stageLineSpacing;

  // Generate Stage Lines (draw enough to cover the screen)
  const maxStageLines = Math.ceil(SVG_WIDTH / stageLineSpacing) + problem.alignStage + 50;
  const stageLines = [];
  for (let i = 0; i < maxStageLines; i++) {
    const x = baseStageX + i * stageLineSpacing;
    if (x > -50 && x < SVG_WIDTH + 50) {
      stageLines.push({ value: i, x });
    }
  }

  // Generate Ocular Lines
  const ocularLines = [];
  for (let i = 0; i <= OCULAR_MAX_LINES; i++) {
    const x = OFFSET_X + i * OCULAR_LINE_SPACING;
    ocularLines.push({ value: i, x });
  }

  return (
    <div className="w-full mx-auto p-6 md:p-10 font-sans text-slate-800 flex flex-col box-border min-h-screen bg-[#f8fafc]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 max-w-6xl mx-auto w-full">
        <div>
          <h1 className="text-[28px] font-bold m-0 text-slate-900 leading-tight">顯微測微器校正練習系統</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">Microscope Micrometer Calibration Practice</p>
        </div>
        <div className="text-left sm:text-right">
          <div className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full font-bold text-sm inline-block">
            物鏡測微器每小格 = {STAGE_DIV_UM} µm
          </div>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">目前的放大倍率隨機產生</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 max-w-6xl mx-auto w-full flex-grow">
        {/* Left Column - Drawing area */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col relative w-full overflow-hidden">
          
          <div className="mb-4 flex justify-between gap-2">
             <span className="font-semibold text-[14px] text-blue-500">● 物鏡測微器 (Stage)</span>
             <span className="font-semibold text-[14px] text-red-500">● 目鏡測微器 (Ocular)</span>
          </div>

          <div className="flex-grow bg-[#fafafa] border border-dashed border-slate-300 rounded-lg flex flex-col relative overflow-hidden group min-h-[300px]">
            {/* SVG Render */}
             <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-slate-200/30 z-10" />
            
            <div className="relative z-0 h-full w-full flex items-center justify-center overflow-hidden">
              <svg 
                width="100%" 
                height="100%" 
                className="select-none" 
              >
                {/* Center guideline line */}
                <line x1="0" y1={CENTER_Y} x2="100%" y2={CENTER_Y} stroke="#e2e8f0" strokeWidth="4" />

                <g transform={`translate(${viewX}, 0)`}>
                  {/* OCULAR MICROMETER (TOP) -> Fixed horizontally relative to view, but moves with View Pan */}
                  <g className="text-red-500" transform={`translate(0, ${CENTER_Y - GAP / 2})`}>
                    <line x1={OFFSET_X - 100} y1="0" x2={SVG_WIDTH + 100} y2="0" stroke="currentColor" strokeWidth="2" opacity="0.8" />
                    
                    {ocularLines.map(({ value, x }) => {
                      const isMajor = value % 10 === 0;
                      const isMid = value % 5 === 0 && !isMajor;
                      const h = isMajor ? 35 : isMid ? 25 : 15; // Pointing down
                      return (
                        <g key={`oc-${value}`} transform={`translate(${x}, 0)`}>
                          <line x1="0" y1="0" x2="0" y2={h} stroke="currentColor" strokeWidth={isMajor ? 2 : 1.5} />
                          {isMajor && (
                            <text x="0" y={-10} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#64748b">{value}</text>
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* STAGE MICROMETER (BOTTOM) -> Moves with Stage X/Y sliders AND has focus blur */}
                  <g 
                    className="text-blue-500 transition-[filter] duration-75" 
                    transform={`translate(${stageX}, ${CENTER_Y + GAP / 2 + stageY})`}
                    style={{ filter: `blur(${blurAmount}px)` }}
                  >
                    <line x1={-1000} y1="0" x2={SVG_WIDTH + 1000} y2="0" stroke="currentColor" strokeWidth="2" opacity="0.8"/>
                    
                    {stageLines.map(({ value, x }) => {
                      const isMajor = value % 10 === 0;
                      const isMid = value % 5 === 0 && !isMajor;
                      const h = isMajor ? -35 : isMid ? -25 : -15; // Pointing up
                      return (
                        <g key={`st-${value}`} transform={`translate(${x}, 0)`}>
                          <line x1="0" y1="0" x2="0" y2={h} stroke="currentColor" strokeWidth={isMajor ? 2 : 1.5} opacity="0.8" />
                        </g>
                      );
                    })}
                  </g>
                </g>
              </svg>
            </div>
          </div>
          
          {/* Microscope Controls Panel */}
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-4 shadow-inner">
            <h4 className="text-[13px] font-bold text-slate-600 m-0 border-b border-slate-200 pb-2">顯微鏡操作面板 (Microscope Controls)</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[12px] font-bold text-slate-500">粗細調節輪 (Focus)</label>
                  <span className="text-[10px] text-slate-400 font-mono">{focusLevel}</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={focusLevel} onChange={(e) => setFocusLevel(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[12px] font-bold text-slate-500">視野平移 (View X)</label>
                  <span className="text-[10px] text-slate-400 font-mono">{viewX}</span>
                </div>
                <input 
                  type="range" min="-800" max="400" 
                  value={viewX} onChange={(e) => setViewX(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[12px] font-bold text-blue-500">載物台 X 軸 (Stage X)</label>
                  <span className="text-[10px] text-slate-400 font-mono">{stageX}</span>
                </div>
                <input 
                  type="range" min="-800" max="800" 
                  value={stageX} onChange={(e) => setStageX(Number(e.target.value))}
                  className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[12px] font-bold text-blue-500">載物台 Y 軸 (Stage Y)</label>
                  <span className="text-[10px] text-slate-400 font-mono">{stageY}</span>
                </div>
                <input 
                  type="range" min="-50" max="30" 
                  value={stageY} onChange={(e) => setStageY(Number(e.target.value))}
                  className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[13px] text-slate-700 shadow-sm">
             <strong className="text-amber-800">操作提示：</strong> 
             請先使用 <strong className="text-slate-600">粗細調節輪</strong> 使物鏡測微器（藍）對焦，接著使用 <strong className="text-blue-600">載物台控制 (X/Y)</strong> 與 <strong className="text-slate-600">視野平移</strong> 尋找兩尺規刻度「完美重疊」的點。
          </div>
        </div>

        {/* Right Column - Questions & Controls */}
        <div className="flex flex-col gap-5 w-full">
           
           {/* Achievement Section */}
           <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 w-full flex flex-col items-center justify-center relative overflow-hidden">
              <h4 className="text-[14px] font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Award className="w-5 h-5 text-amber-500"/> 達人挑戰</h4>
              <p className="text-[13px] text-slate-600 mb-4 font-medium text-center">連續答對 5 題，即可解鎖「顯微測微器校正達人」證書！</p>
              <div className="flex gap-3 mb-4 relative z-10">
                {[1, 2, 3, 4, 5].map(step => (
                  <div key={step} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${streak >= step ? 'bg-amber-100 text-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.6)] border border-amber-300 scale-110' : 'bg-slate-200 text-slate-400 border border-slate-300'}`}>
                    <Star className={`w-4 h-4 ${streak >= step ? 'fill-amber-500' : ''}`} />
                  </div>
                ))}
              </div>
              {streak >= 5 && (
                <button 
                  onClick={() => setShowCertificateForm(true)}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2 animate-bounce cursor-pointer relative z-10"
                >
                  <Award className="w-5 h-5"/> 領取顯微鏡證書
                </button>
              )}
              {/* Confetti or subtle bg effect if won */}
              {streak >= 5 && (
                 <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200 via-transparent to-transparent"></div>
              )}
           </div>

           <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 w-full">
              <h3 className="m-0 mb-4 text-[18px] font-bold text-slate-800">校正計算題</h3>
              <p className="text-[15px] leading-[1.6] text-slate-600 mb-6 font-medium">
                在此倍率下，請觀察左側重疊情形，並計算出目鏡測微器每小格代表的實際長度是多少？
              </p>
              
              <div className="mb-5">
                <label className="block text-[12px] font-bold uppercase text-slate-400 mb-2">
                  填寫答案 (µm)
                </label>
                <div className="relative">
                  <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="final-answer"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-10 pr-12 py-3 border-2 border-slate-200 rounded-lg text-lg font-medium outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-white text-slate-900"
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      if (feedback) setFeedback(null);
                    }}
                    onKeyDown={handleKeyDown}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium select-none">
                    µm
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleCheckAnswer}
                disabled={!userAnswer.trim() || feedback === 'correct'}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors border-none cursor-pointer flex justify-center items-center h-[52px]"
              >
                檢查答案
              </button>

              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`mt-4 p-4 rounded-lg flex items-start gap-3 border ${
                      feedback === 'correct' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {feedback === 'correct' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold text-[15px] mb-1">
                        {feedback === 'correct' ? '答對了！恭喜！' : '不正確，請再試一次。'}
                      </p>
                      {feedback === 'incorrect' && (
                        <p className="text-sm opacity-90 mt-1">
                          提示：嘗試找出兩條線上完全對齊的點。
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>

           <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5 w-full">
              <h4 className="m-0 mb-3 text-[14px] text-slate-500 font-bold">學習與輔助</h4>
              
              <button 
                onClick={() => setShowHint(!showHint)}
                className="flex items-center gap-2 text-[13px] font-semibold text-slate-600 hover:text-blue-600 transition-colors mb-4 w-fit"
              >
                <HelpCircle className="w-4 h-4" />
                <span>顯示計算輔助工具</span>
              </button>

              <AnimatePresence>
                {showHint && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden text-[13px] mb-4"
                  >
                    <div className="pt-2 pb-2">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="text-slate-500 font-medium">物鏡格數 = </span>
                        <input 
                          type="number"
                          min="1"
                          placeholder="0"
                          className="w-20 p-2 text-center border-2 border-slate-200 rounded font-bold outline-none focus:border-blue-500 bg-white"
                          value={stageDivInput}
                          onChange={e => setStageDivInput(e.target.value)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between gap-4 mb-4">
                         <span className="text-slate-500 font-medium">目鏡格數 = </span>
                        <input 
                          type="number"
                          min="1"
                          placeholder="0"
                          className="w-20 p-2 text-center border-2 border-slate-200 rounded font-bold outline-none focus:border-blue-500 bg-white"
                          value={ocularDivInput}
                          onChange={e => setOcularDivInput(e.target.value)}
                        />
                      </div>

                      <div className="bg-white rounded p-3 text-center border border-slate-200 font-mono text-slate-700 shadow-sm">
                        {stageDivInput && ocularDivInput ? (
                          <span>
                            ({stageDivInput} x 10) / {ocularDivInput} = <span className="font-bold text-blue-600">{(parseFloat(stageDivInput) * 10 / parseFloat(ocularDivInput)).toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 opacity-80">
                            (物鏡格數 x 10) / 目鏡格數
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                onClick={initNewProblem}
                className="w-full bg-white text-slate-600 border border-slate-200 hover:bg-slate-100/50 py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} />
                產生新題目
              </button>
           </div>
        </div>
      </div>

      {/* Certificate Form Modal */}
      <AnimatePresence>
        {showCertificateForm && !showCertificate && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden relative"
            >
              <button onClick={() => setShowCertificateForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
              
              <div className="bg-amber-50 p-6 border-b border-amber-100 text-center relative overflow-hidden">
                <div className="w-20 h-20 bg-white text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-amber-200 shadow-sm relative z-10">
                  <Award className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 relative z-10 tracking-wide">登錄證書資料</h2>
                <p className="text-sm text-slate-600 mt-2 relative z-10 font-medium">請填寫您的班級座號與姓名，系統將為您生成專屬電子證書檔案。</p>
              </div>
              
              <div className="p-6 flex flex-col gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 flex justify-between">
                    <span>班級座號</span>
                    <span className="text-slate-400 font-normal">必須為5碼數字</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="例：10122" 
                    className="w-full p-3.5 border-2 border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono text-lg transition-colors placeholder:font-sans"
                    value={studentId}
                    onChange={(e) => {
                       const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                       setStudentId(val);
                    }}
                  />
                  {studentId.length > 0 && studentId.length !== 5 && (
                    <p className="text-[13px] text-red-500 mt-1.5 flex items-center gap-1.5 font-medium"><XCircle className="w-4 h-4"/> 座號格式錯誤</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">中文姓名</label>
                  <input 
                    type="text" 
                    placeholder="例：王小明" 
                    className="w-full p-3.5 border-2 border-slate-200 rounded-lg outline-none focus:border-blue-500 text-lg transition-colors"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <button 
                  disabled={studentId.length !== 5 || !studentName.trim()}
                  onClick={() => {
                    setShowCertificateForm(false);
                    setShowCertificate(true);
                  }}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed text-lg tracking-wide"
                >
                  確認產生證書
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Certificate Display Modal */}
      <AnimatePresence>
        {showCertificate && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto"
          >
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setShowCertificate(false)}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-colors cursor-pointer flex gap-2 items-center"
              >
                <X className="w-5 h-5"/> 返回練習
              </button>
              <button 
                onClick={handleDownloadPdf}
                disabled={isPdfGenerating}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-full shadow-lg hover:shadow-orange-500/25 transition-all cursor-pointer flex gap-2 items-center disabled:opacity-70 disabled:cursor-wait"
              >
                {isPdfGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5"/>}
                {isPdfGenerating ? '正在產生 PDF...' : '下載 PDF 證書'}
              </button>
            </div>

            <div className="w-full max-w-4xl overflow-x-auto pb-8 relative flex justify-center drop-shadow-2xl">
              <div 
                ref={certificateRef}
                className="p-12 shrink-0 relative overflow-hidden"
                style={{ width: '800px', height: '566px', fontFamily: 'serif', backgroundColor: '#faf9f6', color: '#1e293b' }}
              >
                {/* Certificate Background and Borders */}
                <div className="absolute inset-4 border-[14px] border-double" style={{ borderColor: '#cbd5e1' }}></div>
                <div className="absolute inset-x-0 top-0 h-5" style={{ backgroundColor: '#fbbf24' }}></div>
                <div className="absolute inset-x-0 bottom-0 h-5" style={{ backgroundColor: '#fbbf24' }}></div>
                
                {/* Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.05 }}>
                  <Award className="w-[400px] h-[400px]" style={{ color: '#78350f' }} />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between items-center text-center pt-8 pb-4">
                  <div className="space-y-4 w-full">
                    <div className="flex justify-center mb-2"><Award className="w-16 h-16" style={{ color: '#f59e0b' }} /></div>
                    <h1 className="text-4xl font-black tracking-[0.2em] ml-3" style={{ color: '#1e293b' }}>顯微測微器校正達人</h1>
                    <p className="text-xl font-bold tracking-[0.3em] uppercase" style={{ color: '#d97706' }}>Certificate of Excellence</p>
                  </div>

                  <div className="w-full px-20">
                    <p className="text-[17px] mb-8 font-sans" style={{ color: '#475569' }}>茲證明</p>
                    <div className="border-b-2 pb-3 mb-8 flex justify-center items-end gap-10" style={{ borderColor: '#94a3b8' }}>
                      <span className="text-2xl font-bold tracking-widest w-1/2 text-right" style={{ color: '#334155' }}>座號：{studentId}</span>
                      <span className="text-4xl font-black w-1/2 text-left" style={{ color: '#1e293b' }}>{studentName} </span>
                    </div>
                    <p className="text-[17px] leading-[1.8] font-sans mt-2 px-10 text-justify" style={{ color: '#334155' }}>
                      恭喜同學！您在「顯微測微器校正練習系統」中，展現出卓越的顯微鏡操作技巧與精確的數值計算能力，連續正確完成五次測微器刻度數值校正，特發此證，以茲鼓勵。
                    </p>
                  </div>

                  <div className="w-full flex justify-between px-24 mt-4 items-center">
                    <div className="text-center font-sans mt-8">
                      <div className="w-32 border-b mb-2" style={{ borderColor: '#94a3b8' }}></div>
                      <p className="text-[11px] uppercase tracking-widest" style={{ color: '#64748b' }}>Date</p>
                      <p className="font-bold mt-1 text-[15px]" style={{ color: '#334155' }}>{new Date().toLocaleDateString('zh-TW')}</p>
                    </div>
                    
                    <div className="relative flex items-center justify-center w-32 h-32">
                       <div className="w-[110px] h-[110px] rounded-full border-4 flex items-center justify-center rotate-12" style={{ backgroundColor: '#fde68a', borderColor: '#fbbf24' }}>
                         <div className="w-20 h-20 border-2 border-dashed rounded-full flex flex-col items-center justify-center" style={{ borderColor: '#f59e0b', backgroundColor: 'rgba(255,255,255,0.6)' }}>
                            <Star className="w-7 h-7 mb-1" style={{ color: '#f59e0b', fill: '#f59e0b' }}/>
                            <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: '#b45309' }}>Certified</span>
                         </div>
                       </div>
                    </div>

                    <div className="text-center font-sans mt-8">
                       <div className="text-2xl font-black italic mb-1 font-serif tracking-widest" style={{ color: '#1e293b' }}>Avatar Biology</div>
                       <p className="text-xs font-bold tracking-widest" style={{ color: '#64748b' }}>VIRTUAL LAB SYSTEM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 pt-5 border-t border-slate-200 flex justify-between items-center max-w-6xl mx-auto w-full">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span className="text-[12px] text-slate-500 font-medium">系統已就緒</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span className="text-[12px] text-slate-500 font-medium">自動儲存已開啟</span>
          </div>
        </div>
        <div className="text-[12px] text-slate-400 font-medium">
          Developed by Avatar Biology (2026)
        </div>
      </div>
    </div>
  );
}
