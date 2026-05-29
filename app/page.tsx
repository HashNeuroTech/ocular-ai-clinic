"use client";

import React, { useState, useRef } from 'react';
import { Upload, BrainCircuit, Activity, ShieldCheck, Eye, Zap, AlertTriangle, LoaderCircle } from 'lucide-react';

// 定义从 FastAPI 返回的数据契约类型
interface DiagnosticData {
  dr_grade: number;
  glaucoma_risk: number;
  amd_risk: number;
  latency: string;
  task_id: string;
  enhanced_image?: string;
}

export default function DiagnosePage() {
  const [file, setFile] = useState<File | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  
  // 核心：多模态流式病历文本状态
  const [reportText, setReportText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // 用于控制诊断任务的触发和结果存储
  const [diagnoseTaskId, setDiagnoseTaskId] = useState<string | null>(null);
  const [backendResult, setBackendResult] = useState<DiagnosticData | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === 核心逻辑：前端图像预处理 (异步压缩为 WebP) ===
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploadStatus('processing');
    setDiagnoseTaskId(null); 
    setBackendResult(null); // 清空上一次的诊断结果
    setReportText("");      // 清空上一次的文本报告
    
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);

    try {
      const blob = await processImageInBrowser(selectedFile);
      setProcessedBlob(blob);
      setUploadStatus('ready');
    } catch (error) {
      console.error("Image preprocessing failed:", error);
      setUploadStatus('error');
    }
  };

  // === 连通之桥：向 Python FastAPI 发起真实请求并捕获 SSE 文本流 ===
  const startAIAnalysis = async () => {
    if (!processedBlob || !file) return;
    
    setDiagnoseTaskId(`task_connecting`);
    setReportText(""); // 开启新分析前清空旧报告
    
    const formData = new FormData();
    formData.append("file", processedBlob, "optimized_retina.webp");
try {
      // 1. 发起第一阶段的图像分类与增强请求
      const response = await fetch("http://localhost:8000/api/v1/diagnose", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Backend response error");
      const data = await response.json();
      
      // === 核心修复点：确保这里的字段跟 FastAPI 返回的完全一致 ===
      const formattedResult = {
        dr_grade: data.metrics.dr_grade,
        glaucoma_risk: data.metrics.glaucoma_risk,
        amd_risk: data.metrics.amd_risk,
        latency: data.latency,
        task_id: data.task_id,
        enhanced_image: data.enhanced_image
      };

      // 必须先注入结果，打破页面的隐藏门禁！
      setBackendResult(formattedResult);
      setDiagnoseTaskId(data.task_id);
      
      // === 2. 拉起 SSE 监听高级文本流 ===
      setIsStreaming(true);
      const eventSource = new EventSource(`http://localhost:8000/api/v1/report/stream?task_id=${data.task_id}`);

      // 监听常规文本切片追加
      eventSource.addEventListener("message", (event) => {
        setReportText((prev) => prev + event.data);
      });

      // 监听后端明确发出的 'done' 流完结事件
      eventSource.addEventListener("done", () => {
        eventSource.close(); 
        setIsStreaming(false);
      });

      // 错误拦截器
      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setIsStreaming(false);
          return;
        }
        console.error("SSE Stream ended");
        eventSource.close();
        setIsStreaming(false);
      };

    } catch (error) {
      console.error("Failed to fetch diagnostics:", error);
      setUploadStatus('error');
      setDiagnoseTaskId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-100 p-6 md:p-10 font-sans relative">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.02] pointer-events-none" />
      
      {/* 1. 页首导航 (Header) */}
      <nav className="flex justify-between items-center mb-10 backdrop-blur-2xl bg-glass p-4 rounded-3xl border border-glass-stroke shadow-2xl relative z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-neon-cyan/20 rounded-xl flex items-center justify-center border border-neon-cyan/30">
            <Eye className="text-neon-cyan" size={24} />
          </div>
          <span className="text-2xl font-bold tracking-tight">Ocular<span className="text-neon-cyan">AI</span> <span className="text-xs font-mono text-slate-500">v1.0</span></span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-green-400 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
            <Zap size={14} className="animate-pulse" /> Local Inference Node Active
          </div>
          <button className="bg-gradient-to-r from-neon-purple to-neon-cyan px-5 py-2 rounded-xl font-semibold hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all active:scale-95 text-sm flex items-center gap-2">
            <BrainCircuit size={16}/> Connect Node
          </button>
        </div>
      </nav>

      {/* 2. 主内容区 */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
        {/* 左侧栏 */}
        <div className="lg:col-span-3 space-y-8">
          <div 
            className={`relative group border-2 border-dashed border-glass-stroke rounded-3xl p-10 flex flex-col items-center justify-center bg-glass transition-all cursor-pointer overflow-hidden min-h-[420px] ${
              uploadStatus === 'processing' ? 'border-neon-purple/50 bg-neon-purple/5' : ''
            } ${
              uploadStatus === 'ready' ? 'border-neon-cyan/50 bg-neon-cyan/5' : ''
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {(uploadStatus === 'ready' || uploadStatus === 'processing') && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-cyan/10 to-transparent animate-scan pointer-events-none z-10" />
            )}

            {preview ? (
              <div className="relative w-full h-full flex flex-col sm:flex-row items-center justify-center gap-8 z-20">
                {/* 动态双图切换：后端返回增强图后自动过渡并上色 */}
                <img 
                  src={backendResult?.enhanced_image ? backendResult.enhanced_image : preview} 
                  alt="Retinal Preview" 
                  className={`max-h-[300px] rounded-2xl border-4 object-cover aspect-square shadow-2xl transition-all duration-700 ${
                    backendResult?.enhanced_image 
                      ? "border-neon-cyan/50 shadow-[0_0_30px_rgba(6,182,212,0.2)] scale-102" 
                      : "border-white/5"
                  }`} 
                />
                
                {uploadStatus === 'processing' && (
                  <div className="text-center text-neon-purple flex flex-col items-center gap-3">
                    <LoaderCircle className="animate-spin" size={32} />
                    <div className="text-sm font-bold font-mono tracking-wider">PREPROCESSING...</div>
                  </div>
                )}
                {uploadStatus === 'ready' && (
                  <div className="text-center text-neon-cyan flex flex-col items-center gap-3">
                    <ShieldCheck size={32} className="animate-bounce" />
                    <div className="text-sm font-bold font-mono tracking-wider">WEBP ENCRYPTED & READY</div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Upload size={56} className="text-neon-cyan mb-6 relative z-20" />
                <h3 className="text-2xl font-semibold relative z-20">Awaiting Retinal Image</h3>
                <p className="text-slate-400 mt-2.5 relative z-20">Drag & drop or click to upload (.jpg, .png, .dcm)</p>
              </>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard icon={<Zap/>} title="Low-Latency Node" desc="基于 M2 神经网络加速内核" color="cyan" />
            <FeatureCard icon={<ShieldCheck/>} title="Federated Compliance" desc="联邦学习机制数据不出院区" color="purple" />
            <FeatureCard icon={<BrainCircuit/>} title="Multi-Disease Grid" desc="DR, 青光眼, AMD 联合筛查" color="green" />
          </div>
        </div>

        {/* 右侧栏 */}
        <div className="space-y-6">
          <div className="bg-glass border border-glass-stroke rounded-3xl p-7 backdrop-blur-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2.5">
              <Activity className="text-neon-cyan" size={20} />
              Diagnostic Console
            </h2>
            
            <div className="space-y-4">
              <StatusItem label="Engine Status" value="Active" active />
              <StatusItem label="Network Connection" value={diagnoseTaskId ? "Connected" : "Standby"} />
              <StatusItem label="Model Network" value="OcularNet v2.5" font="mono" />
              {file && <StatusItem label="Orig Size" value={`${(file.size / 1024).toFixed(1)} KB`} font="mono" />}
              {processedBlob && <StatusItem label="Opti Size" value={`${(processedBlob.size / 1024).toFixed(1)} KB`} font="mono" />}
            </div>

            <button 
              onClick={startAIAnalysis}
              disabled={uploadStatus !== 'ready' || diagnoseTaskId !== null}
              className={`w-full mt-10 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                (uploadStatus === 'ready' && diagnoseTaskId === null)
                  ? "bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20 hover:border-neon-cyan/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  : "bg-glass-stroke text-slate-600 cursor-not-allowed"
              }`}
            >
              {diagnoseTaskId ? (
                <><BrainCircuit size={18} className="animate-pulse"/> Analyzing...</>
              ) : (
                <><BrainCircuit size={18}/> Run AI Analysis</>
              )}
            </button>
          </div>

          {backendResult && backendResult.dr_grade >= 2 && <RiskAlertWidget/>}
        </div>
      </main>

      {/* 3. 底部异步报告展示区 */}
      {diagnoseTaskId && (
        <section className="max-w-7xl mx-auto mt-12 mb-20 relative z-10">
          <div className="bg-glass border border-glass-stroke rounded-3xl p-8 backdrop-blur-2xl shadow-xl space-y-8">
            <h2 className="text-2xl font-bold flex flex-wrap items-center gap-3 border-b border-glass-stroke pb-4">
              <BrainCircuit className="text-neon-cyan" />
              Preliminary AI Diagnosis Report
              <span className="font-mono text-xs text-slate-500 bg-black/40 px-3 py-1 rounded-full">
                {backendResult ? backendResult.task_id : "Computing..."}
              </span>
            </h2>
            
            {/* 顶层三格核心指标矩阵 */}
            <DiagnosticResultsModel result={backendResult} />

            {/* 大模型流式病历文本生成区 */}
            <div className="bg-black/40 border border-glass-stroke rounded-2xl p-6 font-mono text-sm leading-relaxed relative overflow-hidden">
              <div className="text-slate-500 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full bg-neon-cyan ${isStreaming ? "animate-ping" : ""}`} />
                VLM Structured Clinical Insights (Chinese Language Agent)
              </div>
              
              {/* 格式化输出换行，并追加高科技闪烁光标 */}
              <p className="whitespace-pre-wrap text-slate-200 tracking-wide selection:bg-neon-cyan/30">
                {reportText}
                {isStreaming && <span className="inline-block w-1.5 h-4 bg-neon-cyan ml-0.5 animate-pulse" />}
              </p>

              {!reportText && (
                <div className="text-slate-600 italic animate-pulse">Waiting for localized Visual-Language model to process features...</div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── 子组件 ───
function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: 'cyan' | 'purple' | 'green' }) {
  const colorMap = {
    cyan: "border-neon-cyan/20 text-neon-cyan bg-neon-cyan/5 hover:border-neon-cyan/40",
    purple: "border-neon-purple/20 text-neon-purple bg-neon-purple/5 hover:border-neon-purple/40",
    green: "border-neon-green/20 text-neon-green bg-neon-green/5 hover:border-neon-green/40",
  };
  return (
    <div className={`p-6 rounded-2xl border transition-all cursor-default ${colorMap[color]}`}>
      <div className="mb-3.5 scale-125 origin-left">{icon}</div>
      <div className="text-lg font-bold text-white mb-1.5">{title}</div>
      <div className="text-sm text-slate-400 leading-relaxed">{desc}</div>
    </div>
  );
}

function StatusItem({ label, value, active, font = 'sans' }: { label: string; value: string; active?: boolean; font?: 'sans' | 'mono' }) {
  return (
    <div className="flex justify-between items-center text-sm py-2.5 border-b border-glass-stroke">
      <span className="text-slate-400">{label}</span>
      <span className={`${font === 'mono' ? 'font-mono' : 'font-sans font-medium'} ${active ? "text-green-400" : "text-slate-200"}`}>
        {active && <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />}
        {value}
      </span>
    </div>
  );
}

// 橙红色危险风险挂件
function RiskAlertWidget() {
  return (
    <div className="bg-red-950/20 border border-red-500/30 rounded-3xl p-6 backdrop-blur-xl flex items-start gap-4 text-red-300">
      <AlertTriangle className="text-red-400 flex-shrink-0 scale-125 mt-1" />
      <div>
        <h4 className="font-bold text-red-200">Attention Required</h4>
        <p className="text-xs mt-1 leading-relaxed opacity-90">
          AI detected potential anomalies. Python core node suggests <span className="font-bold text-red-100">Moderate DR (Grade 2)</span>. Please review the detailed grid matrix below.
        </p>
      </div>
    </div>
  );
}

function DiagnosticResultsModel({ result }: { result: DiagnosticData | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <ResultMetric label="Diabetic Retinopathy (DR)" value={result ? `Grade ${result.dr_grade}` : undefined} level={result ? (result.dr_grade > 1 ? 'warning' : 'safe') : 'loading'} />
        <ResultMetric label="Glaucoma Risk" value={result ? `${(result.glaucoma_risk * 100).toFixed(1)}%` : undefined} level={result ? (result.glaucoma_risk > 0.3 ? 'warning' : 'safe') : 'loading'} />
        <ResultMetric label="AMD Risk" value={result ? `${(result.amd_risk * 100).toFixed(1)}%` : undefined} level={result ? (result.amd_risk > 0.2 ? 'warning' : 'safe') : 'loading'} />
      </div>
      <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-3 font-mono text-sm">
        <div className="text-slate-500 uppercase text-xs tracking-wider">Node Performance</div>
        <div className="flex justify-between"><span className="text-slate-400">Total Latency</span> <span className={result ? "text-neon-cyan" : "blur-text text-white"}>{result?.latency || '000ms'}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Model Load</span> <span className="text-white">12.5 MB</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Processor</span> <span className="text-neon-green">Conda (ocular-env)</span></div>
      </div>
    </div>
  );
}

function ResultMetric({ label, value, level }: { label: string; value?: string; level: 'loading' | 'safe' | 'warning' | 'danger' }) {
  const styles = {
    loading: "border-glass-stroke text-slate-600 bg-glass animate-pulse",
    safe: "border-neon-green/20 text-neon-green bg-neon-green/5",
    warning: "border-amber-500/30 text-amber-300 bg-amber-500/10",
    danger: "border-red-500/30 text-red-300 bg-red-500/10",
  };
  return (
    <div className={`p-6 rounded-3xl border transition-all ${styles[level]}`}>
      <div className="text-xs uppercase tracking-wider opacity-70 mb-2 font-medium">{label}</div>
      <div className={`text-3xl font-extrabold font-sans tracking-tight ${level === 'loading' ? 'blur-text' : ''}`}>
        {value || "Grade X"}
      </div>
    </div>
  );
}

// ─── 浏览器端 Canvas 优化函数 ───
async function processImageInBrowser(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob); else reject(new Error("Canvas to Blob failed"));
        }, 'image/webp', 0.85);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}