export interface FileInfo {
    id: string;
    name: string;
    url: string;
    created_at: string;
  }
  
  export interface Comment {
    id: string;
    file_id: string;
    user_name: string;
    content: string;
    created_at: string;
    x_position: number;
    y_position: number;
    page_number: number;
  }
  
  export interface CommentMarker {
    x: number;
    y: number;
    comment: Comment;
  }