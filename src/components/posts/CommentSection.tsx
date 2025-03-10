import { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  createdAt: { toDate: () => Date };
}

interface CommentSectionProps {
  postId: string;
}

const CommentSection = ({ postId }: CommentSectionProps) => {
  const { currentUser, userData } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Подписка на комментарии для данного поста
    const commentsRef = collection(db, 'comments');
    const commentsQuery = query(
      commentsRef,
      where('postId', '==', postId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || !currentUser) return;
    
    setLoading(true);
    
    try {
      // Добавляем новый комментарий
      await addDoc(collection(db, 'comments'), {
        postId,
        text: newComment,
        authorId: currentUser.uid,
        authorName: userData?.displayName || 'Пользователь',
        authorPhotoURL: userData?.photoURL || '',
        createdAt: serverTimestamp()
      });
      
      // Увеличиваем счетчик комментариев в посте
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });
      
      // Очищаем поле ввода
      setNewComment('');
    } catch (error) {
      console.error('Ошибка при добавлении комментария:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Комментарии</h3>
      
      {/* Форма добавления комментария */}
      {currentUser && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex space-x-3">
            <div className="flex-shrink-0">
              {userData?.photoURL ? (
                <img 
                  src={userData.photoURL} 
                  alt="Profile" 
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 font-bold">
                    {userData?.displayName?.charAt(0) || 'U'}
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
      
      {/* Список комментариев */}
      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="flex space-x-3">
              <div className="flex-shrink-0">
                {comment.authorPhotoURL ? (
                  <img 
                    src={comment.authorPhotoURL} 
                    alt={comment.authorName} 
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 font-bold">
                      {comment.authorName.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2 sm:px-6 sm:py-4">
                <div className="sm:flex sm:justify-between sm:items-baseline">
                  <h3 className="text-sm font-medium text-gray-900">
                    {comment.authorName}
                  </h3>
                  {comment.createdAt && (
                    <p className="mt-1 text-xs text-gray-500 sm:mt-0 sm:ml-6">
                      {formatDate(comment.createdAt.toDate())}
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