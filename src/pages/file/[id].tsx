import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocumentProxy } from 'pdfjs-dist';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
      const typedFileData = fileData as FileData;
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
    <div className="container">
      <div className="header">
        <div className="file-name">
          {file?.name || 'Loading...'}
        </div>
        <div className="header-buttons">
          <button onClick={handleExport} className="header-button">
            📄 Export PDF & Comments
          </button>
          <button onClick={handleShare} className="header-button">
            🔗 {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="pdf-section">
          {loading ? (
            <div className="loading-container">
              Loading PDF...
            </div>
          ) : (
            <div id="pdf-container" className="pdf-container" />
          )}
        </div>

        <div className="comments-section">
          {!isNameSubmitted ? (
            <div className="name-form-container">
              <form onSubmit={handleNameSubmit}>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="name-input"
                />
                <button type="submit" className="submit-button">
                  Continue
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="comments-list">
                {comments.map((comment) => (
                  <div className="comment" key={comment.id}>
                    <div className="comment-user">{comment.user_name}</div>
                    <div className="comment-date">
                      {new Date(comment.created_at).toLocaleString()}
                    </div>
                    <div>{comment.content}</div>
                  </div>
                ))}
              </div>
              <div className="comment-form-container">
                <form onSubmit={handleComment}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="comment-textarea"
                  />
                  <button type="submit" className="submit-button">
                    ✈️ Send
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          background-color: #f0f0f0;
        }

        .header {
          padding: 12px 20px;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #fff;
        }

        .file-name {
          font-size: 24px;
          font-weight: bold;
        }

        .header-buttons {
          display: flex;
          gap: 10px;
        }

        .header-button {
          padding: 6px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
        }

        .main-content {
          display: flex;
          height: calc(100vh - 57px);
        }

        .pdf-section {
          width: 80%;
          border-right: 1px solid #ddd;
          background-color: #f0f0f0;
          overflow-y: auto;
        }

        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .pdf-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .comments-section {
          width: 20%;
          display: flex;
          flex-direction: column;
          background-color: #fff;
        }

        .name-form-container {
          padding: 15px;
        }

        .name-input {
          width: calc(100% - 16px);
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 3px;
          margin-bottom: 10px;
        }

        .submit-button {
          width: 100%;
          padding: 8px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 14px;
        }

        .comments-list {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
        }

        .comment {
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 4px;
          margin-bottom: 10px;
        }

        .comment-user {
          font-weight: bold;
        }

        .comment-date {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }

        .comment-form-container {
          border-top: 1px solid #ddd;
          padding: 15px;
        }

        .comment-textarea {
          width: calc(100% - 16px);
          height: 60px;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 3px;
          resize: none;
          margin-bottom: 10px;
          font-size: 14px;
        }

        /* Responsive Styles */
        @media (max-width: 768px) {
          .main-content {
            flex-direction: column;
          }

          .pdf-section {
            width: 100%;
            height: 50vh;
            border-right: none;
            border-bottom: 1px solid #ddd;
          }

          .comments-section {
            width: 100%;
            height: 50vh;
          }
        }
      `}</style>
    </div>
  );
};

export default FilePage;
