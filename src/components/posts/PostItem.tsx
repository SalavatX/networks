import { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { HeartIcon, ChatBubbleLeftIcon, ShareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import CommentSection from './CommentSection';
import Image from '../common/Image';

interface PostItemProps {
  post: {
    id: string;
    content: string;
    imageUrls: string[];
    authorId: string;
    authorName: string;
    authorPhotoURL: string;
    createdAt: { toDate: () => Date };
    likes: string[];
    commentsCount: number;
  };
}

const PostItem = ({ post }: PostItemProps) => {
  const { currentUser } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(currentUser ? post.likes.includes(currentUser.uid) : false);
  const [likesCount, setLikesCount] = useState(post.likes.length);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const toggleLike = async () => {
    if (!currentUser) return;

    const postRef = doc(db, 'posts', post.id);
    
    if (isLiked) {
      // Убираем лайк
      await updateDoc(postRef, {
        likes: arrayRemove(currentUser.uid)
      });
      setIsLiked(false);
      setLikesCount(prev => prev - 1);
    } else {
      // Добавляем лайк
      await updateDoc(postRef, {
        likes: arrayUnion(currentUser.uid)
      });
      setIsLiked(true);
      setLikesCount(prev => prev + 1);
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.uid !== post.authorId) return;
    
    if (window.confirm('Вы уверены, что хотите удалить этот пост?')) {
      try {
        setIsDeleting(true);
        // Удаляем пост из Firestore
        await deleteDoc(doc(db, 'posts', post.id));
        setIsDeleted(true);
      } catch (error) {
        console.error('Ошибка при удалении поста:', error);
        alert('Не удалось удалить пост. Пожалуйста, попробуйте снова.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (isDeleted) {
    return null; // Не отображаем удаленный пост
  }

  return (
    <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
      {/* Заголовок поста с информацией об авторе */}
      <div className="p-4 flex items-center space-x-3">
        <Link to={`/profile/${post.authorId}`}>
          {post.authorPhotoURL ? (
            <img 
              src={post.authorPhotoURL} 
              alt={post.authorName} 
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 font-bold">
                {post.authorName.charAt(0)}
              </span>
            </div>
          )}
        </Link>
        <div className="flex-1">
          <Link to={`/profile/${post.authorId}`} className="font-medium text-gray-900 hover:underline">
            {post.authorName}
          </Link>
          <p className="text-xs text-gray-500">
            {post.createdAt ? formatDate(post.createdAt.toDate()) : 'Недавно'}
          </p>
        </div>
        {currentUser && currentUser.uid === post.authorId && (
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

      {/* Содержимое поста */}
      <div className="px-4 pb-3">
        <p className="text-gray-800 whitespace-pre-line">{post.content}</p>
      </div>

      {/* Изображения */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className={`grid ${post.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-1`}>
          {post.imageUrls.map((url, index) => (
            <div 
              key={index} 
              className={`${post.imageUrls.length === 1 ? 'col-span-1' : index === 0 && post.imageUrls.length === 3 ? 'col-span-2' : ''}`}
            >
              <Image 
                src={url} 
                alt={`Post image ${index + 1}`} 
                className="w-full h-64 object-cover"
                fallback="/placeholder-image.jpg"
              />
            </div>
          ))}
        </div>
      )}

      {/* Кнопки действий */}
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
          <span>{post.commentsCount}</span>
        </button>
        <button className="flex items-center space-x-1 text-gray-500 hover:text-green-500">
          <ShareIcon className="h-5 w-5" />
          <span>Поделиться</span>
        </button>
      </div>

      {/* Секция комментариев */}
      {showComments && (
        <div className="border-t border-gray-200">
          <CommentSection postId={post.id} />
        </div>
      )}
    </div>
  );
};

export default PostItem; 