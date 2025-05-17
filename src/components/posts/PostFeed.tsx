import { useState, useEffect } from 'react';
import PostItem from './PostItem';
import CreatePost from './CreatePost';
import { useAuth } from '../../contexts/AuthContext';
import mysqlService, { Post } from '../../services/mysqlService';

const PostFeed = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const postsPerPage = 5;

  // Функция для загрузки начальных постов
  const loadPosts = async () => {
    setLoading(true);
    try {
      const postsData = await mysqlService.getPosts();
      setPosts(postsData);
      
      // Если получено меньше записей, чем лимит, значит больше нет
      if (postsData.length < postsPerPage) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Ошибка при загрузке постов:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка постов при монтировании компонента
  useEffect(() => {
    loadPosts();
  }, []);

  // Функция обновления списка постов (после создания нового)
  const refreshPosts = () => {
    loadPosts();
  };

  // Функция для загрузки дополнительных постов
  const loadMorePosts = async () => {
    if (!hasMore || loadingMore) return;
    
    setLoadingMore(true);
    
    try {
      const nextPage = page + 1;
      // В реальном API нужно будет реализовать пагинацию
      // Для примера используем обычный запрос
      const morePosts = await mysqlService.getPosts();
      
      if (morePosts.length > 0) {
        setPosts(prevPosts => [...prevPosts, ...morePosts]);
        setPage(nextPage);
        
        if (morePosts.length < postsPerPage) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Ошибка при загрузке дополнительных постов:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">
      {currentUser && (
        <div className="mb-6">
          <CreatePost onPostCreated={refreshPosts} />
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map(post => (
            <PostItem 
              key={post.id} 
              post={post} 
              onPostUpdated={refreshPosts}
            />
          ))}
          
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMorePosts}
                disabled={loadingMore}
                className="btn-gradient px-6 py-2 flex items-center"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Загрузка...
                  </>
                ) : (
                  'Загрузить еще'
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Нет постов</h2>
          <p className="text-gray-600">
            Здесь пока нет постов. Будьте первым, кто поделится чем-то интересным!
          </p>
        </div>
      )}
    </div>
  );
};

export default PostFeed; 