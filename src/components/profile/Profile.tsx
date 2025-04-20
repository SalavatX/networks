import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import PostItem from '../posts/PostItem';
import EditProfile from './EditProfile';
import { UserIcon, PencilIcon, ChatBubbleLeftIcon, UserPlusIcon, UserMinusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Image from '../common/Image';

interface ProfileData {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  bio: string;
  followers: string[];
  following: string[];
}

interface UserData {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followersList, setFollowersList] = useState<UserData[]>([]);
  const [followingList, setFollowingList] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const isOwnProfile = currentUser && userId === currentUser.uid;

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!userId) return;

      try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as ProfileData;
          setProfileData(userData);
          
          if (currentUser && userData.followers) {
            setIsFollowing(userData.followers.includes(currentUser.uid));
          }
        }
        
        const postsRef = collection(db, 'posts');
        const postsQuery = query(
          postsRef,
          where('authorId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        
        const postsSnapshot = await getDocs(postsQuery);
        const postsData = postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setPosts(postsData);
      } catch (error) {
        console.error('Ошибка при загрузке профиля:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [userId, currentUser]);

  const toggleEditProfile = () => {
    setShowEditProfile(!showEditProfile);
  };

  const handleSendMessage = () => {
    if (!currentUser || !profileData) return;
    
    navigate('/messages', { 
      state: { 
        selectedUser: {
          uid: profileData.uid,
          displayName: profileData.displayName,
          photoURL: profileData.photoURL
        } 
      } 
    });
  };

  const toggleFollow = async () => {
    if (!currentUser || !profileData || isOwnProfile) return;
    
    try {
      setIsUpdating(true);
      const userDocRef = doc(db, 'users', profileData.uid);
      const currentUserDocRef = doc(db, 'users', currentUser.uid);
      
      if (isFollowing) {
        await updateDoc(userDocRef, {
          followers: arrayRemove(currentUser.uid)
        });
        
        await updateDoc(currentUserDocRef, {
          following: arrayRemove(profileData.uid)
        });
        
        setIsFollowing(false);
        setProfileData(prev => {
          if (!prev) return null;
          const updatedFollowers = prev.followers.filter(id => id !== currentUser.uid);
          return { ...prev, followers: updatedFollowers };
        });
      } else {
        await updateDoc(userDocRef, {
          followers: arrayUnion(currentUser.uid)
        });
        
        await updateDoc(currentUserDocRef, {
          following: arrayUnion(profileData.uid)
        });
        
        setIsFollowing(true);
        setProfileData(prev => {
          if (!prev) return null;
          return { ...prev, followers: [...prev.followers, currentUser.uid] };
        });
      }
    } catch (error) {
      console.error('Ошибка при изменении подписки:', error);
      alert('Не удалось изменить подписку. Пожалуйста, попробуйте снова.');
    } finally {
      setIsUpdating(false);
    }
  };

  const fetchUsersList = async (userIds: string[]) => {
    if (!userIds.length) return [];
    
    try {
      setLoadingUsers(true);
      const usersData: UserData[] = [];
      
      for (const uid of userIds) {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          usersData.push({
            uid,
            displayName: userData.displayName,
            photoURL: userData.photoURL
          });
        }
      }
      
      return usersData;
    } catch (error) {
      console.error('Ошибка при загрузке списка пользователей:', error);
      return [];
    } finally {
      setLoadingUsers(false);
    }
  };

  const showFollowers = async () => {
    if (!profileData || !profileData.followers.length) return;
    
    const users = await fetchUsersList(profileData.followers);
    setFollowersList(users);
    setShowFollowersModal(true);
  };

  const showFollowing = async () => {
    if (!profileData || !profileData.following.length) return;
    
    const users = await fetchUsersList(profileData.following);
    setFollowingList(users);
    setShowFollowingModal(true);
  };

  const closeModals = () => {
    setShowFollowersModal(false);
    setShowFollowingModal(false);
  };

  const navigateToProfile = (uid: string) => {
    closeModals();
    navigate(`/profile/${uid}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Профиль не найден</h2>
          <p className="mt-2 text-gray-600">Пользователь с указанным ID не существует.</p>
          <Link to="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        
        <div className="px-4 py-5 sm:px-6 -mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-5">
            <div className="flex">
              {profileData.photoURL ? (
                <Image 
                  src={profileData.photoURL} 
                  alt={profileData.displayName || 'Пользователь'} 
                  className="h-24 w-24 rounded-full ring-4 ring-white sm:h-32 sm:w-32"
                  fallback="/placeholder-avatar.jpg"
                />
              ) : (
                <div className="h-24 w-24 rounded-full ring-4 ring-white bg-gray-200 flex items-center justify-center sm:h-32 sm:w-32">
                  <UserIcon className="h-12 w-12 text-gray-500" />
                </div>
              )}
            </div>
            <div className="mt-6 sm:mt-0 sm:flex-1 sm:min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {profileData.displayName || 'Пользователь'}
              </h1>
              <div className="text-sm text-gray-500 flex space-x-4">
                <button 
                  onClick={showFollowers}
                  className="hover:text-indigo-600 transition-colors focus:outline-none"
                  disabled={!profileData.followers?.length}
                >
                  <span className="font-semibold">{profileData.followers?.length || 0}</span> подписчиков
                </button>
                <span>·</span>
                <button 
                  onClick={showFollowing}
                  className="hover:text-indigo-600 transition-colors focus:outline-none"
                  disabled={!profileData.following?.length}
                >
                  <span className="font-semibold">{profileData.following?.length || 0}</span> подписок
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row sm:mt-0 sm:space-x-3">
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={toggleEditProfile}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PencilIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                  Редактировать профиль
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mb-2 sm:mb-0"
                  >
                    <ChatBubbleLeftIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                    Написать
                  </button>
                  <button
                    type="button"
                    onClick={toggleFollow}
                    disabled={isUpdating}
                    className={`inline-flex items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      isFollowing 
                        ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50' 
                        : 'border-transparent text-white bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinusIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                        Отписаться
                      </>
                    ) : (
                      <>
                        <UserPlusIcon className="-ml-1 mr-2 h-5 w-5 text-white" />
                        Подписаться
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="mt-6">
            {profileData.bio ? (
              <p className="text-sm text-gray-700">{profileData.bio}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">Нет информации о пользователе</p>
            )}
          </div>
        </div>
      </div>

      {showEditProfile && (
        <EditProfile 
          profileData={profileData} 
          onClose={toggleEditProfile} 
          onUpdate={(updatedData) => setProfileData({...profileData, ...updatedData})}
        />
      )}

      {showFollowersModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeModals}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Подписчики
                  </h3>
                  <button 
                    onClick={closeModals}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                
                {loadingUsers ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                  </div>
                ) : followersList.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {followersList.map(user => (
                      <li key={user.uid} className="py-4">
                        <button 
                          onClick={() => navigateToProfile(user.uid)}
                          className="flex items-center space-x-3 w-full text-left hover:bg-gray-50 p-2 rounded-md transition-colors"
                        >
                          {user.photoURL ? (
                            <img 
                              src={user.photoURL} 
                              alt={user.displayName || 'Пользователь'} 
                              className="h-10 w-10 rounded-full"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {user.displayName || 'Пользователь'}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-gray-500 py-4">Нет подписчиков</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showFollowingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeModals}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Подписки
                  </h3>
                  <button 
                    onClick={closeModals}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                
                {loadingUsers ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                  </div>
                ) : followingList.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {followingList.map(user => (
                      <li key={user.uid} className="py-4">
                        <button 
                          onClick={() => navigateToProfile(user.uid)}
                          className="flex items-center space-x-3 w-full text-left hover:bg-gray-50 p-2 rounded-md transition-colors"
                        >
                          {user.photoURL ? (
                            <img 
                              src={user.photoURL} 
                              alt={user.displayName || 'Пользователь'} 
                              className="h-10 w-10 rounded-full"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {user.displayName || 'Пользователь'}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-gray-500 py-4">Нет подписок</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Публикации</h2>
        
        {posts.length > 0 ? (
          <div className="space-y-6">
            {posts.map(post => (
              <PostItem key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white shadow rounded-lg">
            <p className="text-gray-500">У пользователя пока нет публикаций.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile; 