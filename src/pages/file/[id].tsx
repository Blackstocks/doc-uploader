import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Define interfaces for your data
interface FileData {
  id: string;
  url: string;
  name: string;
}

interface CommentData {
  id: string;
  file_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

const FilePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [file, setFile] = useState<FileData | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [newComment, setNewComment] = useState<string>('');
  const [comments, setComments] = useState<CommentData[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [isNameSubmitted, setIsNameSubmitted] = useState<boolean>(false);
  const [pdfData, setPdfData] = useState<Blob | null>(null);

  const loadFile = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    try {
      const { data: fileData, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      const typedFileData = fileData as FileData; // Cast to our FileData interface
      setFile(typedFileData);

      const { data } = supabase.storage.from('files').getPublicUrl(typedFileData.url);

      const response = await fetch(data.publicUrl);
      const blob = await response.blob();
      setPdfData(blob);

      const loadingTask = pdfjsLib.getDocument(data.publicUrl);
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setLoading(false);
    } catch (err) {
      console.error('Error loading file:', err);
      setLoading(false);
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('file_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const typedComments = (data ?? []) as CommentData[];
      setComments(typedComments);
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  }, [id]);

  const renderAllPages = useCallback(async () => {
    if (!pdfDocument) return;

    const container = document.getElementById('pdf-container');
    if (!container) return;
    container.innerHTML = '';

    const scale = 1.5;
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const canvas = document.createElement('canvas');
      canvas.id = `page-${pageNum}`;
      container.appendChild(canvas);

      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.marginBottom = '20px';
      canvas.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      canvas.style.backgroundColor = 'white';

      const context = canvas.getContext('2d');
      if (context) {
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
      }
    }
  }, [pdfDocument]);

  useEffect(() => {
    if (id) {
      void loadFile();
      void loadComments();
    }
  }, [id, loadFile, loadComments]);

  useEffect(() => {
    if (pdfDocument) {
      void renderAllPages();
    }
  }, [pdfDocument, renderAllPages]);

  const handleNameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (userName.trim()) {
      setIsNameSubmitted(true);
      localStorage.setItem('userName', userName);
    }
  };

  const handleComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newComment.trim() || !id || typeof id !== 'string') return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            file_id: id,
            user_name: userName,
            content: newComment,
            created_at: new Date().toISOString()
          }
        ])
        .select('id, file_id, user_name, content, created_at')
        .single();

      if (error) {
        console.error('Error saving comment:', error);
        return;
      }

      const newCommentData = data as CommentData;
      setComments(prevComments => [...prevComments, newCommentData]);
      setNewComment('');
    } catch (err) {
      console.error('Error saving comment:', err);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    if (!file) return;

    try {
      const zip = new JSZip();

      if (pdfData) {
        zip.file(file.name, pdfData);
      }

      const commentsText = comments
        .map(c => `${c.user_name} (${new Date(c.created_at).toLocaleString()}): ${c.content}`)
        .join('\n\n');

      zip.file('comments.txt', commentsText);

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.pdf', '')}-with-comments.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error creating export:', err);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      margin: 0,
      padding: 0,
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0'
    }}>
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {file?.name || 'Loading...'}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExport}
            style={{
              padding: '6px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📄 Export PDF & Comments
          </button>
          <button
            onClick={handleShare}
            style={{
              padding: '6px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            🔗 {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        height: 'calc(100vh - 57px)'
      }}>
        <div style={{
          width: '80%',
          borderRight: '1px solid #ddd',
          backgroundColor: '#f0f0f0',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              Loading PDF...
            </div>
          ) : (
            <div
              id="pdf-container"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            />
          )}
        </div>

        <div style={{
          width: '20%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fff'
        }}>
          {!isNameSubmitted ? (
            <div style={{ padding: '15px' }}>
              <form onSubmit={handleNameSubmit}>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  style={{
                    width: 'calc(100% - 16px)',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '3px'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '10px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Continue
                </button>
              </form>
            </div>
          ) : (
            <>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '15px'
              }}>
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    style={{
                      padding: '10px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      marginBottom: '10px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{comment.user_name}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                      {new Date(comment.created_at).toLocaleString()}
                    </div>
                    <div>{comment.content}</div>
                  </div>
                ))}
              </div>
              <div style={{
                borderTop: '1px solid #ddd',
                padding: '15px'
              }}>
                <form onSubmit={handleComment}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    style={{
                      width: 'calc(100% - 16px)',
                      height: '60px',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '3px',
                      resize: 'none',
                      marginBottom: '10px'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    ✈️ Send
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePage;
