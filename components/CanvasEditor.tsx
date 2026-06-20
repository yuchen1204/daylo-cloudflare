import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { 
  Undo, Eraser, Pen, Trash2, Grid3X3, GripHorizontal
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

// Interface for parent to call methods
export interface CanvasEditorRef {
  exportPNG: () => void;
  exportJSON: () => void;
  importJSON: () => void;
}

interface CanvasEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  theme: 'light' | 'dark';
  readOnly?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  type: 'pen' | 'eraser';
}

const PRESET_COLORS = [
  '#000000', '#ef4444', '#f59e0b', '#22c55e', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#d946ef', '#ec4899', '#ffffff', '#9ca3af'
];

export const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(({ content, onChange, theme, readOnly }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]); 
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser'>('pen');
  const [currentColor, setCurrentColor] = useState(theme === 'dark' ? '#ffffff' : '#000000');
  const [currentWidth, setCurrentWidth] = useState(3);
  const [backgroundMode, setBackgroundMode] = useState<'grid' | 'transparent' | 'white' | 'black'>('grid');
  
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Toolbar Dragging State
  const [toolbarPos, setToolbarPos] = useState<{x: number, y: number} | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const toolbarDragOffset = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Sync ref
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  // Data Loading
  useEffect(() => {
    try {
      if (content) {
        const loadedStrokes = JSON.parse(content);
        setStrokes(loadedStrokes);
        strokesRef.current = loadedStrokes;
        if (history.length === 0) {
          setHistory([loadedStrokes]);
          setHistoryStep(0);
        }
      } else {
        setStrokes([]);
        strokesRef.current = [];
        if (history.length === 0) {
           setHistory([[]]);
           setHistoryStep(0);
        }
      }
    } catch (e) {
      console.error("Failed to load canvas content", e);
      setStrokes([]);
      strokesRef.current = [];
    }
  }, [content]); 

  // Drawing Logic
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentStrokes = strokesRef.current;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    currentStrokes.forEach(stroke => {
      if (stroke.points.length < 1) return;
      ctx.beginPath();
      ctx.lineWidth = stroke.width;
      if (stroke.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
      }
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
    
    ctx.globalCompositeOperation = 'source-over';
  }, []); 

  // Resizing Logic
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        const targetWidth = width * dpr;
        const targetHeight = height * dpr;

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.scale(dpr, dpr);
            requestAnimationFrame(draw);
        }
      }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [draw]);

  useEffect(() => { requestAnimationFrame(draw); }, [strokes, draw]);

  // Pointer Events (Drawing)
  const getPoint = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setStrokes(prev => [...prev, {
      points: [getPoint(e)],
      color: currentColor,
      width: currentWidth,
      type: currentTool
    }]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (readOnly || !isDrawing) return;
    const point = getPoint(e);
    setStrokes(prev => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      return [...prev.slice(0, -1), { ...last, points: [...last.points, point] }];
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (readOnly || !isDrawing) return;
    setIsDrawing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(strokes);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    onChange(JSON.stringify(strokes));
  };

  // Toolbar Dragging Logic
  const handleToolbarDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingToolbar(true);
    
    const rect = e.currentTarget.getBoundingClientRect();
    toolbarDragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleToolbarMove = (e: React.PointerEvent) => {
    if (!isDraggingToolbar) return;
    e.stopPropagation();
    
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return;

    // Calculate position relative to the wrapper container
    const newX = e.clientX - toolbarDragOffset.current.x - wrapperRect.left;
    const newY = e.clientY - toolbarDragOffset.current.y - wrapperRect.top;
    
    setToolbarPos({ x: newX, y: newY });
  };

  const handleToolbarUp = (e: React.PointerEvent) => {
    setIsDraggingToolbar(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (toolbarPos && wrapperRect) {
      const containerW = wrapperRect.width;
      const containerH = wrapperRect.height;
      const toolbarRect = toolbarRef.current?.getBoundingClientRect();
      const width = toolbarRect?.width || 60;
      const height = toolbarRect?.height || 300;
      const padding = 16;

      let snapX = toolbarPos.x;
      let snapY = toolbarPos.y;

      if (snapX + width / 2 < containerW / 2) {
        snapX = padding;
      } else {
        snapX = containerW - width - padding;
      }

      snapY = Math.max(padding, Math.min(snapY, containerH - height - padding));

      setToolbarPos({ x: snapX, y: snapY });
    }
  };

  // Tools
  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setStrokes(history[prevStep]);
      onChange(JSON.stringify(history[prevStep]));
    }
  };

  const performClear = () => {
    const empty: Stroke[] = [];
    setStrokes(empty);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(empty);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    onChange(JSON.stringify(empty));
    setIsClearModalOpen(false);
  };

  // --- Export / Import Logic ---

  const handleExportJSON = () => {
    const data = JSON.stringify(strokes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing-${new Date().toISOString().slice(0, 10)}.daylo.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    if (strokes.length === 0) return;

    // Calculate Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(stroke => {
      stroke.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    // Add Padding
    const padding = 40;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // Create temp canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    // Fill Background
    if (backgroundMode !== 'transparent') {
        if (backgroundMode === 'black') {
            ctx.fillStyle = '#000000';
        } else if (backgroundMode === 'white') {
            ctx.fillStyle = '#ffffff';
        } else {
            // Grid mode (default theme background)
            ctx.fillStyle = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        }
        ctx.fillRect(0, 0, width, height);
    }

    // Translate to fit content
    ctx.translate(-minX, -minY);

    // Draw Strokes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach(stroke => {
      if (stroke.points.length < 1) return;
      ctx.beginPath();
      ctx.lineWidth = stroke.width;
      if (stroke.type === 'eraser') {
        // Eraser logic for export
        if (backgroundMode === 'transparent') {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            // Simulate eraser by drawing background color
            if (backgroundMode === 'black') ctx.strokeStyle = '#000000';
            else if (backgroundMode === 'white') ctx.strokeStyle = '#ffffff';
            else ctx.strokeStyle = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        }
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
      }
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });

    // Download
    const url = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const loadedStrokes = JSON.parse(content);
        if (Array.isArray(loadedStrokes)) {
          setStrokes(loadedStrokes);
          const newHistory = history.slice(0, historyStep + 1);
          newHistory.push(loadedStrokes);
          setHistory(newHistory);
          setHistoryStep(newHistory.length - 1);
          onChange(JSON.stringify(loadedStrokes));
        }
      } catch (err) {
        console.error("Failed to import JSON", err);
        alert("Invalid Daylo drawing file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    exportPNG: handleExportPNG,
    exportJSON: handleExportJSON,
    importJSON: () => fileInputRef.current?.click()
  }));

  const isCustomColor = !PRESET_COLORS.includes(currentColor);

  const wrapperW = wrapperRef.current?.getBoundingClientRect().width || window.innerWidth;
  const wrapperH = wrapperRef.current?.getBoundingClientRect().height || window.innerHeight;
  
  const isDockedLeft = toolbarPos ? toolbarPos.x < wrapperW / 2 : true; 
  const isDockedTop = toolbarPos ? toolbarPos.y < wrapperH / 2 : true;

  // Dynamic Background Class
  let bgClass = '';
  if (backgroundMode === 'grid') {
      bgClass = 'bg-white dark:bg-[#1a1a1a] bg-[size:20px_20px] bg-[image:radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[image:radial-gradient(#334155_1px,transparent_1px)]';
  } else if (backgroundMode === 'transparent') {
      bgClass = 'bg-[#f0f0f0] dark:bg-[#2a2a2a] [background-image:linear-gradient(45deg,#e5e5e5_25%,transparent_25%,transparent_75%,#e5e5e5_75%,#e5e5e5),linear-gradient(45deg,#e5e5e5_25%,transparent_25%,transparent_75%,#e5e5e5_75%,#e5e5e5)] [background-size:20px_20px] [background-position:0_0,10px_10px] dark:[background-image:linear-gradient(45deg,#333_25%,transparent_25%,transparent_75%,#333_75%,#333),linear-gradient(45deg,#333_25%,transparent_25%,transparent_75%,#333_75%,#333)]';
  } else if (backgroundMode === 'white') {
      bgClass = 'bg-white';
  } else if (backgroundMode === 'black') {
      bgClass = 'bg-black';
  }

  return (
    <div ref={wrapperRef} className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-900 relative">
      
      {/* Hidden Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".json" 
        className="hidden" 
        onChange={handleImportJSON}
      />

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden cursor-crosshair touch-none transition-colors ${bgClass}`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="block touch-none absolute top-0 left-0"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* TOOLBAR */}
      {!readOnly && (
      <div 
        ref={toolbarRef}
        onPointerDown={handleToolbarDown}
        onPointerMove={handleToolbarMove}
        onPointerUp={handleToolbarUp}
        className={`absolute z-50 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl transition-all duration-200
          rounded-2xl p-2 flex flex-col gap-2 touch-none select-none cursor-move
          ${!toolbarPos ? 'top-4 left-4' : ''}
        `}
        style={toolbarPos ? { 
          left: toolbarPos.x, 
          top: toolbarPos.y, 
          bottom: 'auto', 
          transform: 'none',
          transition: isDraggingToolbar ? 'none' : 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' 
        } : {}}
      >
         {/* Drag Handle */}
         <div className="w-full flex justify-center pb-1 opacity-50 hover:opacity-100 transition-opacity">
            <GripHorizontal className="w-4 h-4 text-slate-400 dark:text-slate-500" />
         </div>

         {/* Tools */}
         <div className="flex flex-col gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentTool('pen'); }}
              className={`p-3 rounded-xl transition-all ${currentTool === 'pen' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400'}`}
              title="Pen"
            >
              <Pen className="w-5 h-5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentTool('eraser'); }}
              className={`p-3 rounded-xl transition-all ${currentTool === 'eraser' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-400'}`}
              title="Eraser"
            >
              <Eraser className="w-5 h-5" />
            </button>
         </div>

         <div className="w-full h-px bg-slate-200 dark:bg-slate-700"></div>

         {/* Settings Toggle */}
         <div className="relative">
           <button
             onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }}
             className={`w-full p-2 rounded-xl transition-all flex items-center justify-center
               ${isSettingsOpen ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}
             `}
             title="Settings"
           >
             <div 
               className="rounded-full border border-slate-200 dark:border-slate-600 shadow-sm"
               style={{ 
                 width: Math.max(12, Math.min(24, currentWidth + 4)), 
                 height: Math.max(12, Math.min(24, currentWidth + 4)),
                 backgroundColor: currentColor
               }}
             />
           </button>

            {/* SETTINGS PANEL (Nested Popover) */}
            {isSettingsOpen && (
              <div 
                className={`absolute z-[60] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-4 flex flex-col gap-4 w-72 cursor-default
                   ${isDockedLeft ? 'left-full ml-4' : 'right-full mr-4'}
                   ${isDockedTop ? 'top-0' : 'bottom-0'}
                `}
                onPointerDown={(e) => e.stopPropagation()} 
              >
                 {/* Background Section */}
                 <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Background</div>
                    <div className="grid grid-cols-4 gap-2">
                       <button 
                         onClick={() => setBackgroundMode('grid')}
                         className={`h-8 rounded-lg border flex items-center justify-center ${backgroundMode === 'grid' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                         title="Grid"
                       >
                          <Grid3X3 className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => setBackgroundMode('transparent')}
                         className={`h-8 rounded-lg border flex items-center justify-center ${backgroundMode === 'transparent' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                         title="Transparent"
                       >
                          <div className="w-4 h-4 border border-slate-300 dark:border-slate-500 bg-[url(https://www.transparenttextures.com/patterns/checkerboard-cross-hatch.png)] opacity-50"></div>
                       </button>
                       <button 
                         onClick={() => setBackgroundMode('white')}
                         className={`h-8 rounded-lg border flex items-center justify-center ${backgroundMode === 'white' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                         title="White"
                       >
                          <div className="w-4 h-4 bg-white border border-slate-200 rounded-sm"></div>
                       </button>
                       <button 
                         onClick={() => setBackgroundMode('black')}
                         className={`h-8 rounded-lg border flex items-center justify-center ${backgroundMode === 'black' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                         title="Black"
                       >
                          <div className="w-4 h-4 bg-black border border-slate-700 rounded-sm"></div>
                       </button>
                    </div>
                 </div>

                 <div className="h-px w-full bg-slate-100 dark:bg-slate-700"></div>

                 {/* Width Slider */}
                 <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>Width</span>
                      <span>{currentWidth}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="30" 
                      value={currentWidth} 
                      onChange={(e) => setCurrentWidth(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                 </div>

                 <div className="h-px w-full bg-slate-100 dark:bg-slate-700"></div>

                 {/* Colors */}
                 <div className="grid grid-cols-6 gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => { setCurrentColor(c); }}
                        className={`w-8 h-8 rounded-full border border-slate-100 dark:border-slate-600 shadow-sm hover:scale-110 transition-transform ${currentColor === c ? 'ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-slate-800 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                 </div>
                 
                 {/* Custom Color Input */}
                 <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700"></div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Custom</span>
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700"></div>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="relative flex-1 h-9 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                     <input 
                       type="color" 
                       value={currentColor}
                       onChange={(e) => setCurrentColor(e.target.value)}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                     />
                     <div className="w-full h-full flex items-center justify-center font-mono text-xs text-slate-600 dark:text-slate-300" style={{ backgroundColor: currentColor }}>
                        <span className="bg-black/20 px-1 rounded text-white">{currentColor}</span>
                     </div>
                   </div>
                 </div>
              </div>
            )}

         </div>

         <div className="w-full h-px bg-slate-200 dark:bg-slate-700"></div>

         {/* Actions */}
         <div className="flex flex-col gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); handleUndo(); }}
              disabled={historyStep <= 0}
              className="p-3 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo"
            >
              <Undo className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsClearModalOpen(true)}
              className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
              title="Clear"
            >
              <Trash2 className="w-5 h-5" />
            </button>
         </div>
      </div>
      )}

      <ConfirmModal 
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={performClear}
        title="Clear Canvas"
        message="Are you sure you want to clear the entire canvas? This action cannot be undone."
        confirmText="Clear Everything"
        isDangerous
      />

    </div>
  );
});
CanvasEditor.displayName = 'CanvasEditor';