import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

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
  email?: string | null;
}

interface ChatListProps {
  chats: Chat[];
  users: User[];
  currentUserId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onStartNewChat: (user: User) => void;
}

const ChatList = ({ 
  chats, 
  users, 
  currentUserId, 
  selectedChatId, 
  onSelectChat, 
  onStartNewChat 
}: ChatListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      const results = usersSnapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as User))
        .filter(user => 
          user.uid !== currentUserId && 
          (user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           user.email?.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      
      setSearchResults(results);
    } catch (error) {
      console.error('Ошибка при поиске пользователей:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  };

  const getChatName = (chat: Chat) => {
    const otherParticipantId = chat.participants.find(id => id !== currentUserId);
    if (!otherParticipantId) return 'Чат';
    
    const otherUser = users.find(user => user.uid === otherParticipantId);
    return otherUser?.displayName || 'Пользователь';
  };

  const getChatAvatar = (chat: Chat) => {
    const otherParticipantId = chat.participants.find(id => id !== currentUserId);
    if (!otherParticipantId) return null;
    
    const otherUser = users.find(user => user.uid === otherParticipantId);
    return otherUser?.photoURL;
  };

  const getLastMessagePreview = (chat: Chat) => {
    if (!chat.lastMessage) return 'Нет сообщений';
    
    const isOwnMessage = chat.lastMessage.senderId === currentUserId;
    const prefix = isOwnMessage ? 'Вы: ' : '';
    
    return `${prefix}${chat.lastMessage.text}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Поиск пользователей */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Поиск пользователей..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          className="mt-2 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isSearching ? 'Поиск...' : 'Найти'}
        </button>
      </div>

      {/* Результаты поиска */}
      {searchResults.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Результаты поиска</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {searchResults.map(user => (
              <div 
                key={user.uid}
                onClick={() => onStartNewChat(user)}
                className="flex items-center p-2 hover:bg-gray-50 rounded-md cursor-pointer"
              >
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'Пользователь'} 
                    className="h-10 w-10 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-500 font-bold">
                      {user.displayName?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.displayName || 'Пользователь'}</p>
                  <p className="text-xs text-gray-500 truncate">Нажмите, чтобы начать чат</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto">
        {chats.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {chats.map(chat => (
              <div 
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedChatId === chat.id ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  {getChatAvatar(chat) ? (
                    <img 
                      src={getChatAvatar(chat) || ''} 
                      alt={getChatName(chat)} 
                      className="h-12 w-12 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-6 w-6 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {getChatName(chat)}
                      </h3>
                      {chat.lastMessage && chat.lastMessage.timestamp && (
                        <p className="text-xs text-gray-500 flex-shrink-0">
                          {formatDate(chat.lastMessage.timestamp.toDate())}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {getLastMessagePreview(chat)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            <p>У вас пока нет чатов.</p>
            <p className="mt-1 text-sm">Используйте поиск, чтобы найти пользователей и начать общение.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList; 