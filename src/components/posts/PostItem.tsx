import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { HeartIcon, ChatBubbleLeftIcon, ShareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import CommentSection from './CommentSection';
import Image from '../common/Image';
import mysqlService, { Post } from '../../services/mysqlService';

interface PostItemProps {
  post: Post;
  onPostUpdated?: () => void;
}

const PostItem: React.FC<PostItemProps> = ({ post, onPostUpdated }) => {
  const { currentUser } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(
    currentUser ? post.likes.includes(currentUser.uid) : false
  );
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const toggleLike = async () => {
    if (!currentUser) return;

    try {
      const response = await mysqlService.likePost(post.id);
      
      if (response.liked) {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      } else {
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      }
    } catch (error) {
      console.error('Ошибка при лайке поста:', error);
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: ru });
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.uid !== post.author.uid) return;
    
    if (window.confirm('Вы уверены, что хотите удалить этот пост?')) {
      try {
        setIsDeleting(true);
        // Удаляем пост через API
        await mysqlService.deletePost(post.id);
        setIsDeleted(true);
        
        // Обновляем список постов
        if (onPostUpdated) {
          onPostUpdated();
        }
      } catch (error) {
        console.error('Ошибка при удалении поста:', error);
        alert('Не удалось удалить пост. Пожалуйста, попробуйте снова.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (isDeleted) {
    return null; 
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
      <div className="p-4 flex items-center space-x-3">
        <Link to={`/profile/${post.author.uid}`}>
          {post.author.photoURL ? (
            <img 
              src={post.author.photoURL} 
              alt={post.author.displayName || 'Пользователь'} 
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 font-bold">
                {post.author.displayName?.charAt(0) || 'U'}
              </span>
            </div>
          )}
        </Link>
        <div className="flex-1">
          <Link to={`/profile/${post.author.uid}`} className="font-medium text-gray-900 hover:underline">
            {post.author.displayName || 'Пользователь'}
          </Link>
          <p className="text-xs text-gray-500">
            {post.createdAt ? formatDate(post.createdAt) : 'Недавно'}
          </p>
        </div>
        {currentUser && currentUser.uid === post.author.uid && (
          <button
            onClick={handleDeletePost}
            disabled={isDeleting}
            className="text-gray-400 hover:text-red-500"
            title="Удалить пост"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-4 pb-3">
        <p className="text-gray-800 whitespace-pre-line">{post.text}</p>
      </div>

      {/* Изображение */}
      {post.imageUrl && (
        <div>
          <Image 
            src={post.imageUrl} 
            alt="Изображение поста" 
            className="w-full h-96 object-cover cursor-pointer"
            fallback="/placeholder-image.jpg"
            onClick={() => window.open(post.imageUrl, '_blank')}
          />
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-200 flex justify-between">
        <button 
          onClick={toggleLike}
          className={`flex items-center space-x-1 ${isLiked ? 'text-red-500' : 'text-gray-500'} hover:text-red-500`}
        >
          {isLiked ? (
            <HeartIconSolid className="h-5 w-5" />
          ) : (
            <HeartIcon className="h-5 w-5" />
          )}
          <span>{likesCount}</span>
        </button>
        <button 
          onClick={toggleComments}
          className="flex items-center space-x-1 text-gray-500 hover:text-blue-500"
        >
          <ChatBubbleLeftIcon className="h-5 w-5" />
          <span>{post.comments.length}</span>
        </button>
        <button className="flex items-center space-x-1 text-gray-500 hover:text-green-500">
          <ShareIcon className="h-5 w-5" />
          <span>Поделиться</span>
        </button>
      </div>

      {showComments && (
        <div className="border-t border-gray-200">
          <CommentSection 
            postId={post.id} 
            comments={post.comments}
            onCommentAdded={onPostUpdated} 
          />
        </div>
      )}
    </div>
  );
};

export default PostItem; 