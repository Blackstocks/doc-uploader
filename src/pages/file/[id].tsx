import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import type { FileInfo, Comment } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function FilePage() {
 const router = useRouter();
 const { id } = router.query;
 const [file, setFile] = useState<FileInfo | null>(null);
 const [comments, setComments] = useState<Comment[]>([]);
 const [newComment, setNewComment] = useState({ userName: '', content: '' });
 const [pdfUrl, setPdfUrl] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
   if (id) {
     fetchFileAndComments();
   }
 }, [id]);

 useEffect(() => {
   if (file) {
     loadPDF();
   }
 }, [file]);

 const fetchFileAndComments = async () => {
   try {
     const [fileData, commentsData] = await Promise.all([
       supabase.from('files').select('*').eq('id', id).single(),
       fetch(`/api/comments?fileId=${id}`).then(res => res.json())
     ]);

     setFile(fileData.data);
     setComments(commentsData);
   } catch (error) {
     console.error('Error fetching data:', error);
   } finally {
     setLoading(false);
   }
 };

 const loadPDF = async () => {
   if (!file) return;
   
   const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${file.url}`;
   
   try {
     const response = await fetch(fileUrl);
     const arrayBuffer = await response.arrayBuffer();
     const base64 = btoa(
       new Uint8Array(arrayBuffer)
         .reduce((data, byte) => data + String.fromCharCode(byte), '')
     );
     setPdfUrl(`data:application/pdf;base64,${base64}`);
   } catch (error) {
     console.error('Error loading PDF:', error);
   }
 };

 const handleComment = async (e: React.FormEvent) => {
   e.preventDefault();
   
   const response = await fetch('/api/comments', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       fileId: id,
       ...newComment,
     }),
   });

   const data = await response.json();
   setComments([...comments, data]);
   setNewComment({ userName: '', content: '' });
 };

 const handleExport = async () => {
   const commentsText = comments
     .map(c => `${c.user_name} (${format(new Date(c.created_at), 'PPpp')}): ${c.content}`)
     .join('\n\n');

   const blob = new Blob([commentsText], { type: 'text/plain' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `${file?.name}-comments.txt`;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   URL.revokeObjectURL(url);
 };

 const renderFilePreview = () => {
   const fileType = file?.name.split('.').pop()?.toLowerCase();
   const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${file?.url}`;

   if (fileType === 'pdf') {
     return (
       <div className="w-full h-[600px] border rounded overflow-hidden">
         {pdfUrl ? (
           <iframe 
             src={pdfUrl}
             className="w-full h-full"
             title="PDF Viewer"
           />
         ) : (
           <div className="flex items-center justify-center h-full">
             Loading PDF...
           </div>
         )}
       </div>
     );
   }

   if (['doc', 'docx'].includes(fileType || '')) {
     return (
       <div className="w-full h-[600px] flex items-center justify-center bg-gray-100">
         <div className="text-center">
           <p className="mb-4">Word documents cannot be previewed directly.</p>
           <a 
             href={fileUrl}
             download
             className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
           >
             Download Document
           </a>
         </div>
       </div>
     );
   }

   return (
     <div className="text-red-500">
       Unsupported file type
     </div>
   );
 };

 if (loading) return (
   <div className="min-h-screen flex items-center justify-center">
     <div className="text-xl">Loading...</div>
   </div>
 );

 if (!file) return (
   <div className="min-h-screen flex items-center justify-center">
     <div className="text-xl text-red-500">File not found</div>
   </div>
 );

 return (
   <div className="min-h-screen p-8">
     <div className="max-w-4xl mx-auto">
       <div className="flex justify-between items-center mb-8">
         <h1 className="text-3xl font-bold">{file.name}</h1>
         <div className="flex items-center gap-4">
           <a 
             href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${file.url}`}
             download
             className="text-blue-500 hover:underline"
           >
             Download
           </a>
           <input
             type="text"
             value={`${window.location.origin}/file/${id}`}
             readOnly
             className="bg-gray-100 px-4 py-2 rounded"
           />
         </div>
       </div>

       <div className="grid grid-cols-2 gap-8">
         <div>
           {renderFilePreview()}
         </div>

         <div>
           <h2 className="text-xl font-bold mb-4">Comments</h2>
           
           <form onSubmit={handleComment} className="mb-6">
             <input
               type="text"
               placeholder="Your name"
               value={newComment.userName}
               onChange={e => setNewComment({ ...newComment, userName: e.target.value })}
               className="w-full mb-2 px-4 py-2 border rounded"
               required
             />
             <textarea
               placeholder="Add a comment..."
               value={newComment.content}
               onChange={e => setNewComment({ ...newComment, content: e.target.value })}
               className="w-full mb-2 px-4 py-2 border rounded"
               required
             />
             <button
               type="submit"
               className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
             >
               Add Comment
             </button>
           </form>

           <div className="space-y-4">
             {comments.map(comment => (
               <div key={comment.id} className="border rounded p-4">
                 <div className="font-bold">{comment.user_name}</div>
                 <div className="text-sm text-gray-500">
                   {format(new Date(comment.created_at), 'PPpp')}
                 </div>
                 <div className="mt-2">{comment.content}</div>
               </div>
             ))}
           </div>
         </div>
       </div>

       <button
         onClick={handleExport}
         className="fixed bottom-8 left-8 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
       >
         Export Comments
       </button>
     </div>
   </div>
 );
}