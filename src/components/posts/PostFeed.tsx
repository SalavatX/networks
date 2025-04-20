import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../../firebase/config';
import PostItem from './PostItem';
import CreatePost from './CreatePost';
import { useAuth } from '../../contexts/AuthContext';

const PostFeed = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const postsPerPage = 5;

  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const postsQuery = query(
      postsRef,
      orderBy('createdAt', 'desc'),
      limit(postsPerPage)
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const postsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPosts(postsData);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadMorePosts = async () => {
    if (!lastVisible || !hasMore) return;
    
    setLoadingMore(true);
    
    try {
      const postsRef = collection(db, 'posts');
      const postsQuery = query(
        postsRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(postsPerPage)
      );
      
      const snapshot = await getDocs(postsQuery);
      
      if (!snapshot.empty) {
        const newPosts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setPosts(prevPosts => [...prevPosts, ...newPosts]);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Ошибка при загрузке постов:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">
      {currentUser && (
        <div className="mb-6">
          <CreatePost />
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map(post => (
            <PostItem key={post.id} post={post} />
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