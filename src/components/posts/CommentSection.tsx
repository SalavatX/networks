import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import mysqlService, { Comment } from '../../services/mysqlService';

interface CommentSectionProps {
  postId: string;
  comments: Comment[];
  onCommentAdded?: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ 
  postId, 
  comments = [], 
  onCommentAdded 
}) => {
  const { currentUser } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || !currentUser) return;
    
    setLoading(true);
    
    try {
      await mysqlService.addComment(postId, newComment);
      setNewComment('');
      
      // Обновляем список комментариев через родительский компонент
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Ошибка при добавлении комментария:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: ru });
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Комментарии</h3>
      
      {currentUser && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex space-x-3">
            <div className="flex-shrink-0">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt="Profile" 
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 font-bold">
                    {currentUser.displayName?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="border border-gray-300 rounded-lg shadow-sm overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <textarea
                  rows={2}
                  name="comment"
                  id="comment"
                  className="block w-full py-3 border-0 resize-none focus:ring-0 sm:text-sm p-2"
                  placeholder="Добавить комментарий..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !newComment.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Отправка...' : 'Отправить'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
      
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="flex space-x-3">
              <div className="flex-shrink-0">
                {comment.author.photoURL ? (
                  <img 
                    src={comment.author.photoURL} 
                    alt={comment.author.displayName || 'Пользователь'} 
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 font-bold">
                      {comment.author.displayName?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2 sm:px-6 sm:py-4">
                <div className="sm:flex sm:justify-between sm:items-baseline">
                  <h3 className="text-sm font-medium text-gray-900">
                    {comment.author.displayName || 'Пользователь'}
                  </h3>
                  {comment.createdAt && (
                    <p className="mt-1 text-xs text-gray-500 sm:mt-0 sm:ml-6">
                      {formatDate(comment.createdAt)}
                    </p>
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  <p>{comment.text}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center">Нет комментариев. Будьте первым!</p>
        )}
      </div>
    </div>
  );
};

export default CommentSection; 