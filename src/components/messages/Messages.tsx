import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';

interface Chat {
  id: string;
  participants: string[];
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: { toDate: () => Date };
  };
  unreadCount: number;
}

interface User {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

const Messages = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChatList, setShowChatList] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  useEffect(() => {
    if (location.state && location.state.selectedUser) {
      setSelectedUser(location.state.selectedUser);
      if (isMobile) {
        setShowChatList(false);
      }
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname, isMobile]);

  useEffect(() => {
    if (!currentUser) return;

    const chatsRef = collection(db, 'chats');
    const chatsQuery = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessage.timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      
      setChats(chatsData);
      
      const userIds = new Set<string>();
      chatsData.forEach(chat => {
        chat.participants.forEach(participantId => {
          if (participantId !== currentUser.uid) {
            userIds.add(participantId);
          }
        });
      });
      
      if (userIds.size > 0) {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const usersData = usersSnapshot.docs
          .filter(doc => userIds.has(doc.id))
          .map(doc => ({
            uid: doc.id,
            ...doc.data()
          })) as User[];
        
        setUsers(usersData);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
    
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const otherUserId = chat.participants.find(id => id !== currentUser?.uid);
      if (otherUserId) {
        const user = users.find(u => u.uid === otherUserId);
        if (user) {
          setSelectedUser(user);
        }
      }
    }
    
    if (isMobile) {
      setShowChatList(false);
    }
  };

  const handleStartNewChat = (user: User) => {

    const existingChat = chats.find(chat => 
      chat.participants.length === 2 && 
      chat.participants.includes(user.uid) && 
      chat.participants.includes(currentUser?.uid || '')
    );
    
    if (existingChat) {
      handleSelectChat(existingChat.id);
    } else {
      setSelectedUser(user);
      setSelectedChat(null); 
      
      if (isMobile) {
        setShowChatList(false);
      }
    }
  };

  const toggleChatList = () => {
    setShowChatList(!showChatList);
  };
  const handleBackToList = () => {
    setShowChatList(true);
  };

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Доступ запрещен</h2>
          <p className="mt-2 text-gray-600">Вы должны войти в систему, чтобы просматривать сообщения.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Сообщения</h1>
        
        {isMobile && (
          <button 
            onClick={toggleChatList}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {showChatList ? 'Показать чат' : 'Показать список'}
          </button>
        )}
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="flex h-[calc(100vh-200px)] max-w-full overflow-hidden">
          {(!isMobile || showChatList) && (
            <div className={`${isMobile ? 'w-full' : 'w-1/3'} border-r border-gray-200 overflow-hidden`}>
              <ChatList 
                chats={chats} 
                users={users} 
                currentUserId={currentUser.uid} 
                selectedChatId={selectedChat}
                onSelectChat={handleSelectChat}
                onStartNewChat={handleStartNewChat}
              />
            </div>
          )}
          
          {(!isMobile || !showChatList) && (
            <div className={`${isMobile ? 'w-full' : 'w-2/3'} overflow-hidden`}>
              {selectedChat || selectedUser ? (
                <ChatWindow 
                  chatId={selectedChat} 
                  currentUser={currentUser} 
                  otherUser={selectedUser}
                  onBackToList={isMobile ? handleBackToList : undefined}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Выберите чат или начните новую беседу</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages; 