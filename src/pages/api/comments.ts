import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { fileId, userName, content } = req.body;

    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          file_id: fileId,
          user_name: userName,
          content,
        },
      ])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data[0]);
  }

  if (req.method === 'GET') {
    const { fileId } = req.query;

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}