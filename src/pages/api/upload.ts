import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb'
    }
  }
};

type SupabaseError = {
  message: string;
  statusCode: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, fileName } = req.body;
    const fileBuffer = Buffer.from(file.split(',')[1], 'base64');
    const fileExt = fileName.split('.').pop().toLowerCase();

    if (!['pdf', 'doc', 'docx'].includes(fileExt)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }

    const { data, error: uploadError } = await supabase.storage
      .from('files')
      .upload(`${Date.now()}-${fileName}`, fileBuffer);

    if (uploadError) {
      throw uploadError;
    }

    const fileRecord = await supabase
      .from('files')
      .insert([
        {
          name: fileName,
          url: data.path,
        },
      ])
      .select()
      .single();

    res.status(200).json(fileRecord.data);
  } catch (error: unknown) {
    const err = error as SupabaseError;
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Error uploading file' });
  }
}