
import React, { useState, useCallback, useEffect } from 'react';
import { 
  Layers, 
  Maximize, 
  RefreshCcw, 
  ChevronLeft, 
  Upload, 
  Download, 
  Loader2, 
  MousePointer2, 
  Code2, 
  Cpu, 
  CheckCircle2,
  Trash2,
  Image as ImageIcon,
  FileCode,
  Key,
  History,
  RotateCcw
} from 'lucide-react';
import { ToolType, ProcessingState, ImageFile } from './types';
import { traceImageToSVG } from './utils/vectorEngine';
import { processAIImage } from './services/geminiService';
import { fileToBlobUrl, blobUrlToBase64, getImageDimensions, downloadUrl } from './utils/imageUtils';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.DASHBOARD);
  const [sourceImage, setSourceImage] = useState<ImageFile | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    error: null,
    resultUrl: null,
    resultType: 'png'
  });

  const currentImageUrl = processing.resultUrl || sourceImage?.url || null;

  useEffect(() => {
    return () => {
      if (sourceImage?.url) URL.revokeObjectURL(sourceImage.url);
      if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
    };
  }, []);

  const handleReset = () => {
    if (sourceImage?.url) URL.revokeObjectURL(sourceImage.url);
    if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
    setSourceImage(null);
    setProcessing({ isProcessing: false, progress: 0, error: null, resultUrl: null, resultType: 'png' });
    setActiveTool(ToolType.DASHBOARD);
  };

  const handleDiscardChanges = () => {
    if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
    setProcessing(p => ({ ...p, resultUrl: null, error: null, progress: 0, resultType: 'png' }));
  };

  const onFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = fileToBlobUrl(file);
    const dims = await getImageDimensions(url);
    setSourceImage({ url, name: file.name, type: file.type, width: dims.width, height: dims.height });
    setProcessing(p => ({ ...p, resultUrl: null, error: null, progress: 0, resultType: 'png' }));
  };

  const handleToolSelect = (tool: ToolType) => {
    setActiveTool(tool);
    setProcessing(p => ({ ...p, error: null, progress: 0 }));
  };

  const handleBgRemovalClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentImageUrl || processing.isProcessing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    setProcessing(p => ({ ...p, isProcessing: true, progress: 20, error: null }));
    try {
      const base64 = await blobUrlToBase64(currentImageUrl);
      const systemInstruction = `You are a Surgical Precision Editor. Given coordinates, isolate the subject and remove the background into 100% transparency. Do not change anything else. Return ONLY image data.`;
      const prompt = `Remove background. Subject at X:${xPercent.toFixed(1)}%, Y:${yPercent.toFixed(1)}%. Preserve subject details.`;
      const resultBase64 = await processAIImage('gemini-2.5-flash-image', base64, prompt, systemInstruction);
      
      if (resultBase64) {
        if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
        const response = await fetch(resultBase64);
        const resUrl = URL.createObjectURL(await response.blob());
        setProcessing({ isProcessing: false, progress: 100, error: null, resultUrl: resUrl, resultType: 'png' });
      }
    } catch (err: any) {
      setProcessing(p => ({ ...p, isProcessing: false, progress: 0, error: err.message }));
    }
  };

  const handleUpscale = async () => {
    if (!currentImageUrl || processing.isProcessing) return;
    
    setProcessing(p => ({ ...p, isProcessing: true, progress: 10, error: null }));
    try {
      const base64 = await blobUrlToBase64(currentImageUrl);
      
      const systemInstruction = `You are the PIXELPRO Strict Upscaler. 
      CORE OBJECTIVE: Perform a high-fidelity upscale of the input.
      STRICT RULES:
      1. Do NOT add new details, textures, or "generative" hallucinations.
      2. If the background is transparent, KEEP it transparent.
      3. If the background is solid, KEEP it solid.
      4. Only perform edge-sharpening and noise-reduction.
      5. The output must look exactly like the input, just sharper and larger.
      Return ONLY image data.`;
      
      const prompt = `Perform a strict 4x upscale on this iteration. Improve resolution and edge clarity only. Maintain the exact aesthetic and background state.`;
      
      const resultBase64 = await processAIImage('gemini-2.5-flash-image', base64, prompt, systemInstruction);
      if (resultBase64) {
        if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
        const response = await fetch(resultBase64);
        const resUrl = URL.createObjectURL(await response.blob());
        setProcessing({ isProcessing: false, progress: 100, error: null, resultUrl: resUrl, resultType: 'png' });
      }
    } catch (err: any) {
      setProcessing(p => ({ ...p, isProcessing: false, progress: 0, error: err.message }));
    }
  };

  const handleVectorize = async () => {
    if (!currentImageUrl || processing.isProcessing) return;
    setProcessing(p => ({ ...p, isProcessing: true, progress: 0, error: null }));
    try {
      // OBSIDIAN ELITE SETTINGS: 2x High-Fidelity Super-Sampling
      // Balanced for performance (no freeze) and professional sharpness.
      const svgString = await traceImageToSVG(currentImageUrl, (progress) => {
        setProcessing(p => ({ ...p, progress }));
      }, { tolerance: 1, maxWidth: 4096, maxHeight: 4096, superSample: 2 });
      
      if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      setProcessing({ isProcessing: false, progress: 100, error: null, resultUrl: url, resultType: 'svg' });
    } catch (err: any) {
      setProcessing(p => ({ ...p, isProcessing: false, progress: 0, error: err.message }));
    }
  };

  const handleExport = () => {
    if (!processing.resultUrl) return;
    const ext = processing.resultType || 'png';
    const filename = `pixelpro-v14-elite-export-${Date.now()}.${ext}`;
    downloadUrl(processing.resultUrl, filename);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 flex flex-col selection:bg-indigo-500/30">
      <header className="h-16 border-b border-white/5 flex items-center px-6 justify-between bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleReset}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10 transition-transform group-hover:scale-105">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">PixelPro Studio</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {sourceImage && (
            <div className="flex items-center gap-3">
               {processing.resultUrl && (
                <button 
                  onClick={handleDiscardChanges} 
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-rose-500/10 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-400 transition-all border border-white/5"
                >
                  <RotateCcw size={14} /> Revert Changes
                </button>
              )}
              <button 
                onClick={handleReset} 
                className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-all border border-white/5"
              >
                Close Project
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        {!sourceImage ? (
          <div className="w-full max-w-2xl text-center space-y-12 animate-in fade-in zoom-in duration-700">
            <div className="space-y-4">
              <h2 className="text-6xl lg:text-8xl font-black tracking-tighter text-white leading-[0.9]">OBSIDIAN ELITE. <span className="text-indigo-500">V14.</span></h2>
              <p className="text-slate-500 text-lg max-w-lg mx-auto leading-relaxed font-medium">
                Surgical cutout, strict upscale, and Obsidian Elite vectorization. Zero seams. Absolute 1:1 pixel fidelity with zero-lag batch processing.
              </p>
            </div>

            <label className="block group cursor-pointer">
              <div className="relative border border-white/10 rounded-[3rem] p-20 bg-white/[0.02] group-hover:bg-white/[0.04] group-hover:border-indigo-500/50 transition-all duration-500 shadow-2xl">
                <input type="file" className="hidden" accept="image/*" onChange={onFileUpload} />
                <div className="flex flex-col items-center gap-8">
                  <div className="w-24 h-24 rounded-3xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                    <Upload className="w-12 h-12 text-indigo-400" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black text-white uppercase italic">Initialize HQ Buffer</p>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Tap to upload high-fidelity asset</p>
                  </div>
                </div>
              </div>
            </label>
          </div>
        ) : (
          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-12 animate-in slide-in-from-bottom-12 duration-1000">
            <div className="space-y-8 flex flex-col h-full">
              <div className="relative flex-1 min-h-[500px] bg-black/80 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl flex items-center justify-center group">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
                
                {activeTool === ToolType.BG_REMOVER && !processing.isProcessing && (
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 bg-indigo-500 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 shadow-2xl animate-pulse ring-8 ring-indigo-500/20">
                    <MousePointer2 size={16} /> Tap target subject
                  </div>
                )}

                {processing.resultUrl && !processing.isProcessing && (
                   <div className="absolute top-10 right-10 z-20 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 backdrop-blur-md">
                    <History size={14} /> Elite Build
                  </div>
                )}
                
                <div 
                  className={`relative max-w-[90%] max-h-[90%] transition-all duration-1000 ${processing.isProcessing ? 'opacity-20 scale-95 blur-2xl' : 'opacity-100 scale-100'}`}
                  onClick={activeTool === ToolType.BG_REMOVER ? handleBgRemovalClick : undefined}
                >
                  <img 
                    src={currentImageUrl || ''} 
                    alt="Workspace" 
                    className="object-contain cursor-crosshair drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                  />
                  {processing.isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-30 scale-125">
                      <div className="relative">
                        <Loader2 className="w-20 h-20 text-indigo-500 animate-spin" />
                        <div className="absolute inset-0 blur-3xl bg-indigo-500/40 animate-pulse"></div>
                      </div>
                      <div className="text-center space-y-3">
                        <p className="text-white font-black text-3xl uppercase tracking-tighter italic">Obsidian Elite Build</p>
                        <div className="w-56 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${processing.progress}%` }}></div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enabling Async Row Batching & Atomic Seam Weld</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {processing.error && (
                <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-widest flex items-center gap-5">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <Trash2 size={18} />
                  </div>
                  System Error: {processing.error}
                </div>
              )}

              {processing.resultUrl && !processing.isProcessing && (
                <div className="flex items-center justify-center gap-8 animate-in slide-in-from-top-4 duration-700">
                  <button 
                    onClick={handleExport}
                    className="flex items-center gap-4 px-12 py-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all shadow-2xl hover:scale-105 uppercase tracking-widest text-sm"
                  >
                    <Download size={24} /> Export Elite Build
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-8 flex flex-col">
              <div className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 flex flex-col h-full space-y-12">
                <div className="space-y-2">
                  <h3 className="font-black text-indigo-500 uppercase text-[10px] tracking-[0.4em]">Pixel Pro Modules</h3>
                  <p className="text-white text-xl font-bold tracking-tight">Elite Forge Hub</p>
                </div>

                <div className="space-y-5 flex-1">
                  {[
                    { id: ToolType.BG_REMOVER, icon: MousePointer2, title: 'Surgical Cutout', desc: 'Isolate Subject Perfectly', color: 'text-rose-400' },
                    { id: ToolType.UPSCALER, icon: Maximize, title: 'Strict 4K Forge', desc: '1:1 Fidelity Scaling', color: 'text-emerald-400' },
                    { id: ToolType.VECTOR_CONVERTER, icon: FileCode, title: 'Obsidian Elite', desc: 'Lag-Free 1:1 Vectorizing', color: 'text-amber-400' }
                  ].map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolSelect(tool.id)}
                      className={`w-full flex items-center gap-6 p-6 rounded-[2rem] transition-all border ${activeTool === tool.id ? 'bg-indigo-500/20 border-indigo-500 shadow-2xl shadow-indigo-500/10' : 'bg-transparent border-white/5 hover:bg-white/5 hover:border-white/20'}`}
                    >
                      <div className={`p-4 rounded-2xl ${activeTool === tool.id ? 'bg-indigo-500/20' : 'bg-white/5'}`}>
                        <tool.icon className={`w-6 h-6 ${activeTool === tool.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                      </div>
                      <div className="text-left">
                        <p className={`text-base font-black italic uppercase tracking-tighter ${activeTool === tool.id ? 'text-white' : 'text-slate-500'}`}>{tool.title}</p>
                        <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{tool.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-8 border-t border-white/5">
                  {activeTool === ToolType.UPSCALER && (
                    <button 
                      onClick={handleUpscale}
                      disabled={processing.isProcessing}
                      className="w-full py-6 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center justify-center gap-4 hover:shadow-2xl transition-all disabled:opacity-50 uppercase tracking-[0.2em] text-xs italic"
                    >
                      Initialize 4K Forge
                    </button>
                  )}
                  {activeTool === ToolType.VECTOR_CONVERTER && (
                    <button 
                      onClick={handleVectorize}
                      disabled={processing.isProcessing}
                      className="w-full py-6 rounded-[2rem] bg-amber-600 hover:bg-amber-500 text-white font-black flex items-center justify-center gap-4 hover:shadow-2xl transition-all disabled:opacity-50 uppercase tracking-[0.2em] text-xs italic"
                    >
                      Initialize Obsidian Elite
                    </button>
                  )}
                  {activeTool === ToolType.BG_REMOVER && (
                    <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 text-center">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Elite Flux Active</p>
                      <p className="text-[11px] text-slate-500 mt-2 font-medium italic">Select iteration subject to isolate</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="h-12 border-t border-white/5 flex items-center justify-center text-[9px] font-black uppercase tracking-[0.6em] text-zinc-700">
        PixelPro Studio Core v3.4.8 • Obsidian Elite Vector V14 • Zero-Seam 1:1 Absolute Fidelity
      </footer>
    </div>
  );
};

export default App;
