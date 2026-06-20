import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus, Move, Trash2, Edit2, GitCommitHorizontal, CornerDownRight, X } from 'lucide-react';

interface MindMapNode {
  id: string;
  x: number;
  y: number;
  label: string;
  parentId: string | null;
}

interface MindMapEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  theme: 'light' | 'dark';
  readOnly?: boolean;
}

const DEFAULT_ROOT: MindMapNode = {
  id: 'root',
  x: window.innerWidth / 2 - 50,
  y: window.innerHeight / 2 - 20,
  label: 'Central Topic',
  parentId: null
};

// Robust ID generator
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

export const MindMapEditor: React.FC<MindMapEditorProps> = ({ content, onChange, theme, readOnly }) => {
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  // Viewport State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // Interaction Refs (Mutable for performance/tracking)
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef<Map<number, { x: number, y: number }>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialScale = useRef<number>(1);
  const isDraggingNode = useRef<boolean>(false);
  const dragNodeId = useRef<string | null>(null);
  
  // Mobile Detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Helper: Center view on root node
  const centerRoot = useCallback(() => {
    const root = nodes.find(n => !n.parentId) || nodes[0];
    if (!root) return;

    // Use container dimensions or fallback to window (for shared view initial load)
    const viewportW = containerRef.current?.clientWidth || window.innerWidth;
    const viewportH = containerRef.current?.clientHeight || window.innerHeight;
    
    const nodeW = 180; 
    const nodeH = 40;

    // Ensure we don't get NaN
    const targetX = (viewportW - nodeW) / 2 - root.x;
    const targetY = (viewportH - nodeH) / 2 - root.y;

    if (!isNaN(targetX) && !isNaN(targetY)) {
      setScale(1);
      setOffset({ x: targetX, y: targetY });
    }
  }, [nodes]);

  // Initialize
  useEffect(() => {
    try {
      if (content) {
        // Handle case where content might already be an object (defensive)
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        setNodes(Array.isArray(parsed) ? parsed : [DEFAULT_ROOT]);
      } else {
        const root = { ...DEFAULT_ROOT, x: window.innerWidth / 2 - 50, y: window.innerHeight / 2 - 20 };
        setNodes([root]);
        onChange(JSON.stringify([root]));
      }
    } catch (e) {
      console.error("Failed to parse mindmap content", e);
      setNodes([DEFAULT_ROOT]);
    }

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [content]);

  // Auto-center for read-only mode on load
  useEffect(() => {
    if (readOnly && nodes.length > 0) {
       // Small timeout to ensure layout is ready
       const timer = setTimeout(centerRoot, 100);
       return () => clearTimeout(timer);
    }
  }, [readOnly, nodes.length === 0]); // Trigger when nodes first populate

  // Sync to parent
  const updateNodes = (newNodes: MindMapNode[]) => {
    setNodes(newNodes);
    onChange(JSON.stringify(newNodes));
  };

  // Helper: Get distance between first two pointers
  const getPinchDistance = () => {
    if (activePointers.current.size < 2) return null;
    const points = Array.from(activePointers.current.values());
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  // --- Pointer Events (Unified) ---

  const handlePointerDown = (e: React.PointerEvent) => {
    // Allow input interactions
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Check if clicking a node
    const targetNode = (e.target as HTMLElement).closest('[data-node-id]');
    const nodeId = targetNode?.getAttribute('data-node-id');

    if (nodeId && activePointers.current.size === 1) {
      if (readOnly) return; // No selection or dragging in read-only mode
      // Single pointer on node -> Drag Node / Select
      isDraggingNode.current = true;
      dragNodeId.current = nodeId;
      setSelectedNodeId(nodeId);
      e.stopPropagation();
    } else if (activePointers.current.size === 1) {
      // Single pointer on background -> Pan (Start implies select none if strictly background)
      if (!targetNode && !readOnly) {
        setSelectedNodeId(null);
        setEditingNodeId(null);
      }
    } else if (activePointers.current.size === 2) {
      // Two pointers -> Zoom Start
      const dist = getPinchDistance();
      if (dist) {
        initialPinchDist.current = dist;
        initialScale.current = scale;
      }
      // Cancel dragging if zooming
      isDraggingNode.current = false;
      dragNodeId.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;

    const prev = activePointers.current.get(e.pointerId)!;
    const curr = { x: e.clientX, y: e.clientY };
    activePointers.current.set(e.pointerId, curr);

    // 1. Pinch Zoom
    if (activePointers.current.size === 2) {
      const dist = getPinchDistance();
      if (dist && initialPinchDist.current) {
        const ratio = dist / initialPinchDist.current;
        const newScale = Math.min(Math.max(initialScale.current * ratio, 0.2), 3);
        setScale(newScale);
      }
      return;
    }

    // 2. Drag Node
    if (activePointers.current.size === 1 && isDraggingNode.current && dragNodeId.current && !readOnly) {
      const deltaX = (curr.x - prev.x) / scale;
      const deltaY = (curr.y - prev.y) / scale;

      setNodes(prevNodes => prevNodes.map(n => {
        if (n.id === dragNodeId.current) {
          return { ...n, x: n.x + deltaX, y: n.y + deltaY };
        }
        return n;
      }));
      return;
    }

    // 3. Pan Canvas
    if (activePointers.current.size === 1) {
      setOffset(prevOffset => ({
        x: prevOffset.x + (curr.x - prev.x),
        y: prevOffset.y + (curr.y - prev.y)
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (activePointers.current.size < 2) {
      initialPinchDist.current = null;
    }

    if (isDraggingNode.current) {
      isDraggingNode.current = false;
      dragNodeId.current = null;
      // Persist changes on drag end
      onChange(JSON.stringify(nodes));
    }
  };

  // --- Logic Actions ---

  const addChildNode = (e?: React.MouseEvent) => {
    if (readOnly) return;
    e?.stopPropagation();
    if (!selectedNodeId) return;
    const parent = nodes.find(n => n.id === selectedNodeId);
    if (!parent) return;

    const newNode: MindMapNode = {
      id: generateId(),
      x: parent.x + 200,
      y: parent.y + (Math.random() - 0.5) * 50, 
      label: 'New Topic',
      parentId: parent.id
    };

    const newNodes = [...nodes, newNode];
    updateNodes(newNodes);
    setSelectedNodeId(newNode.id);
    setEditingNodeId(newNode.id);
  };

  const addSiblingNode = (e?: React.MouseEvent) => {
    if (readOnly) return;
    e?.stopPropagation();
    if (!selectedNodeId) return;
    const current = nodes.find(n => n.id === selectedNodeId);
    if (!current || !current.parentId) return;

    const newNode: MindMapNode = {
      id: generateId(),
      x: current.x,
      y: current.y + 80,
      label: 'New Topic',
      parentId: current.parentId
    };

    const newNodes = [...nodes, newNode];
    updateNodes(newNodes);
    setSelectedNodeId(newNode.id);
    setEditingNodeId(newNode.id);
  };

  const deleteSelectedNode = (e?: React.MouseEvent) => {
    if (readOnly) return;
    e?.stopPropagation();
    if (!selectedNodeId || selectedNodeId === 'root') return;

    const toDelete = new Set<string>([selectedNodeId]);
    let added = true;
    while (added) {
      added = false;
      nodes.forEach(n => {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          added = true;
        }
      });
    }

    const newNodes = nodes.filter(n => !toDelete.has(n.id));
    updateNodes(newNodes);
    setSelectedNodeId(null);
  };

  // --- Render Helpers ---

  const renderConnections = () => {
    return nodes.map(node => {
      if (!node.parentId) return null;
      const parent = nodes.find(n => n.id === node.parentId);
      if (!parent) return null;

      // Approximate node centers/edges for cleaner lines
      const pWidth = 120; // estimated
      const pHeight = 40;
      
      const startX = parent.x + pWidth; 
      const startY = parent.y + pHeight / 2; 
      const endX = node.x;
      const endY = node.y + pHeight / 2;

      const deltaX = endX - startX;
      
      // Curve logic
      const path = `M ${startX} ${startY} C ${startX + Math.max(deltaX / 2, 50)} ${startY}, ${endX - Math.max(deltaX / 2, 50)} ${endY}, ${endX} ${endY}`;

      return (
        <path
          key={`${parent.id}-${node.id}`}
          d={path}
          stroke={theme === 'dark' ? '#475569' : '#cbd5e1'}
          strokeWidth="2"
          fill="none"
        />
      );
    });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden select-none touch-none">
      
      {/* Main Canvas Area */}
      <div 
        ref={containerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] bg-white dark:bg-[#1a1a1a]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={(e) => {
           // Simple wheel zoom/pan
           if (e.ctrlKey) {
             e.preventDefault();
             const s = Math.exp(-e.deltaY * 0.001);
             setScale(prev => Math.min(Math.max(prev * s, 0.2), 3));
           } else {
             setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
           }
        }}
      >
        <div 
          style={{ 
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'absolute',
            pointerEvents: 'none' // Allow pointer events to pass to container unless on interactive children
          }}
        >
          {/* Connections Layer */}
          <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ zIndex: 0 }}>
             {renderConnections()}
          </svg>

          {/* Nodes Layer */}
          {nodes.map(node => (
            <div
              key={node.id}
              data-node-id={node.id}
              className={`absolute rounded-xl shadow-sm border transition-colors duration-200 flex items-center justify-center pointer-events-auto
                ${selectedNodeId === node.id 
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-200 dark:bg-indigo-900/40 dark:border-indigo-400 dark:text-indigo-100 dark:ring-indigo-900' 
                  : 'bg-white border-slate-200 hover:border-indigo-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                }
              `}
              style={{
                left: node.x,
                top: node.y,
                minWidth: '120px',
                maxWidth: '250px',
                minHeight: '40px',
                padding: '8px 16px',
                zIndex: 10
              }}
              onDoubleClick={(e) => { 
                if (readOnly) return;
                e.stopPropagation(); 
                setEditingNodeId(node.id); 
              }}
            >
              {editingNodeId === node.id ? (
                <input
                  autoFocus
                  defaultValue={node.label}
                  onBlur={(e) => {
                    updateNodes(nodes.map(n => n.id === node.id ? { ...n, label: e.target.value } : n));
                    setEditingNodeId(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="bg-transparent outline-none text-center w-full text-sm font-medium text-slate-900 dark:text-slate-100"
                  // Stop propagation to prevent dragging while typing
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 text-center pointer-events-none">
                  {node.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Controls Layer (UI Overlays) */}
      
      {/* Zoom Controls */}
      <div className="absolute bottom-24 right-6 flex flex-col gap-2 z-20 md:bottom-6">
         <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col gap-1">
            <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
               <Plus className="w-5 h-5" />
            </button>
            <div className="h-px bg-slate-100 dark:bg-slate-700 mx-1" />
            <button onClick={() => setScale(s => Math.max(s - 0.1, 0.2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
               <Minus className="w-5 h-5" />
            </button>
            <div className="h-px bg-slate-100 dark:bg-slate-700 mx-1" />
            <button onClick={centerRoot} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400" title="Reset View">
               <Move className="w-5 h-5" />
            </button>
         </div>
      </div>

      {/* Context Toolbar (Responsive) */}
      {selectedNode && !readOnly && (
        <div 
           className={`
             absolute z-30 flex items-center gap-1 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in duration-200
             ${isMobile 
                ? 'bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm justify-between' 
                : ''
             }
           `}
           style={!isMobile ? {
             left: selectedNode.x * scale + offset.x + (140 * scale), 
             top: selectedNode.y * scale + offset.y,
             transform: 'translateY(-50%)'
           } : {}}
           // Prevent canvas interaction when clicking toolbar
           onPointerDown={(e) => e.stopPropagation()}
        >
           <button 
             onClick={addChildNode} 
             className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-1"
           >
              <GitCommitHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Child</span>
           </button>
           
           <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

           <button 
             onClick={addSiblingNode} 
             className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-1"
           >
              <CornerDownRight className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Sibling</span>
           </button>

           <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

           <button 
             onClick={() => setEditingNodeId(selectedNode.id)} 
             className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-1"
           >
              <Edit2 className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Edit</span>
           </button>

           <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

           <button 
             onClick={deleteSelectedNode} 
             className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors flex-1"
           >
              <Trash2 className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1">Delete</span>
           </button>

           {isMobile && (
             <>
               <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
               <button 
                 onClick={() => setSelectedNodeId(null)}
                 className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors flex-1"
               >
                  <X className="w-5 h-5" />
                  <span className="text-[10px] font-medium mt-1">Close</span>
               </button>
             </>
           )}
        </div>
      )}
    </div>
  );
};