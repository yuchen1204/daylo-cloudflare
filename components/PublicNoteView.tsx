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

  const parsedTags = useMemo(() => {
    if (!note?.tags) return [];
    if (Array.isArray(note.tags)) return note.tags;
    try {
      return JSON.parse(note.tags as unknown as string);
    } catch {
      return [];
    }
  }, [note?.tags]);

  if (loading) {
    return (
      <div className="noise flex w-full items-center justify-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', minHeight: '100dvh' }}>
        <div className="flex flex-col items-center gap-4">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--text-primary)' }}></div>
           <span className="text-sm font-medium">Loading shared note...</span>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="noise flex w-full flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', minHeight: '100dvh' }}>
        <h1 className="text-2xl font-bold">404</h1>
        <p>{error || "Note not found."}</p>
        <Link to="/" className="hover:underline" style={{ color: 'var(--text-secondary)' }}>Go to Daylo</Link>
      </div>
    );
  }

  const isCanvas = note.format === 'canvas';
  const isMindMap = note.format === 'mindmap';
  const isVisualEditor = isCanvas || isMindMap;

  return (
     <div className="noise min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', height: '100dvh', overflow: 'hidden' }}>
       {/* Header */}
       <div className="h-12 sm:h-16 border-b flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20 backdrop-blur-sm shrink-0"
            style={{ borderColor: 'var(--border-subtle)', background: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)' }}>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
             <span className="font-bold text-base sm:text-xl tracking-tight shrink-0" style={{ color: 'var(--text-primary)' }}>Daylo</span>
             <span className="shrink-0" style={{ color: 'var(--border-primary)' }}>/</span>
             <span className="font-medium text-sm sm:text-base truncate min-w-0">{note.title}</span>
          </div>
          <Link to="/" className="text-xs sm:text-sm font-medium hover:underline transition-colors shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>
            Try Daylo
          </Link>
       </div>

       {/* Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden" style={{ height: 'calc(100dvh - 48px)' }}>
          {isVisualEditor ? (
            <div className="flex-1 relative overflow-hidden w-full h-full" style={{ background: 'var(--bg-secondary)' }}>
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
             <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 overflow-y-auto h-full">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">{note.title}</h1>
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-5 sm:mb-8">
                   {parsedTags.map(tag => (
                     <span key={tag} className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full border"
                           style={{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text, borderColor: getTagColor(tag).border }}>
                       #{tag}
                     </span>
                   ))}
                   <span className="text-[10px] sm:text-xs flex items-center" style={{ color: 'var(--text-muted)' }}>
                     {new Date(note.updatedAt).toLocaleDateString()}
                   </span>
                </div>
                <div className="markdown-preview text-base sm:text-lg leading-relaxed">
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
