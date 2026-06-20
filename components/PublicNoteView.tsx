import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Note } from '../types';
import { cloudSyncService } from '../services/cloudflare-sync';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTagColor } from '../constants';
import { CanvasEditor } from './CanvasEditor';
import { MindMapEditor } from './MindMapEditor';

export const PublicNoteView: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }

    const fetchNote = async () => {
      if (!linkId) return;
      try {
        const data = await cloudSyncService.getPublicNote(linkId);
        if (data) {
          setNote(data);
        } else {
          setError("Note not found or not shared.");
        }
      } catch (e) {
        setError("Failed to load note.");
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [linkId]);

  const processedContent = useMemo(() => {
    if (!note?.content) return "";
    return note.content.replace(/\[\[(.*?)\]\]/g, '$1');
  }, [note?.content]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-4">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
           <span className="text-sm font-medium">Loading shared note...</span>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-500 gap-4">
        <h1 className="text-2xl font-bold">404</h1>
        <p>{error || "Note not found."}</p>
        <Link to="/" className="text-indigo-600 hover:underline">Go to Daylo</Link>
      </div>
    );
  }

  const isCanvas = note.format === 'canvas';
  const isMindMap = note.format === 'mindmap';
  const isVisualEditor = isCanvas || isMindMap;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
       {/* Header */}
       <div className="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
             <span className="font-bold text-xl tracking-tight text-indigo-600 dark:text-indigo-400">Daylo</span>
             <span className="text-slate-300 dark:text-slate-700">/</span>
             <span className="font-medium truncate max-w-[200px] sm:max-w-md">{note.title}</span>
          </div>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Try Daylo
          </Link>
       </div>

       {/* Content */}
       <div className="flex-1 flex flex-col relative overflow-hidden" style={{ height: 'calc(100% - 64px)' }}>
          {isVisualEditor ? (
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 relative overflow-hidden w-full h-full">
               {isCanvas ? (
                 <div className="absolute inset-0 pointer-events-none w-full h-full">
                    <CanvasEditor content={note.content} theme={theme} readOnly={true} onChange={()=>{}} />
                 </div>
               ) : (
                 <div className="w-full h-full">
                    <MindMapEditor content={note.content} theme={theme} readOnly={true} onChange={()=>{}} />
                 </div>
               )}
            </div>
          ) : (
             <div className="max-w-3xl mx-auto w-full px-6 py-10 overflow-y-auto h-full">
                <h1 className="text-4xl font-bold mb-4">{note.title}</h1>
                <div className="flex flex-wrap gap-2 mb-8">
                   {note.tags?.map(tag => (
                     <span key={tag} className={`px-2 py-0.5 text-xs rounded-full border ${getTagColor(tag)}`}>
                       #{tag}
                     </span>
                   ))}
                   <span className="text-xs text-slate-400 flex items-center">
                     {new Date(note.updatedAt).toLocaleDateString()}
                   </span>
                </div>
                <div className="markdown-preview text-lg leading-relaxed">
                   <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={url => url}>
                     {processedContent}
                   </ReactMarkdown>
                </div>
             </div>
          )}
       </div>
    </div>
  );
};