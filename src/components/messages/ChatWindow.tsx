import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  doc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { PaperAirplaneIcon, TrashIcon, UserIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: { toDate: () => Date };
  read: boolean;
}

interface ChatUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

interface ChatWindowProps {
  chatId: string | null;
  currentUser: User;
  otherUser: ChatUser | null;
  onBackToList?: () => void;
}

const ChatWindow = ({ chatId, currentUser, otherUser, onBackToList }: ChatWindowProps) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Определяем, является ли устройство мобильным
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
    if (!currentUser) return;
    
    const fetchOrCreateChat = async () => {
      // Если у нас есть ID чата, получаем сообщения
      if (chatId) {
        const messagesRef = collection(db, 'messages');
        const messagesQuery = query(
          messagesRef,
          where('chatId', '==', chatId),
          orderBy('timestamp', 'asc')
        );
        
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
          const messagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];
          
          setMessages(messagesData);
          setLoading(false);
          
          // Отмечаем сообщения как прочитанные
          messagesData.forEach(async (message) => {
            if (message.senderId !== currentUser.uid && !message.read) {
              await updateDoc(doc(db, 'messages', message.id), {
                read: true
              });
            }
          });
        });
        
        return unsubscribe;
      } 
      else if (otherUser) {
        setLoading(false);
        return () => {};
      }
      
      return () => {};
    };
    
    const unsubscribePromise = fetchOrCreateChat();
    
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }).catch(error => {
        console.error('Ошибка при отписке от чата:', error);
      });
    };
  }, [chatId, currentUser, otherUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;
    
    try {
      let chatDocRef;
      

      if (chatId) {
        chatDocRef = doc(db, 'chats', chatId);
      } 

      else if (otherUser) {
        const chatsRef = collection(db, 'chats');
        const chatsQuery = query(
          chatsRef,
          where('participants', 'array-contains', currentUser.uid)
        );
        
        const chatsSnapshot = await getDocs(chatsQuery);
        const existingChat = chatsSnapshot.docs.find(doc => {
          const data = doc.data();
          return data.participants.includes(otherUser.uid);
        });
        
        if (existingChat) {
          chatDocRef = doc(db, 'chats', existingChat.id);
        } else {
          const newChatRef = doc(collection(db, 'chats'));
          await setDoc(newChatRef, {
            participants: [currentUser.uid, otherUser.uid],
            createdAt: serverTimestamp(),
            lastMessage: {
              text: newMessage,
              senderId: currentUser.uid,
              timestamp: serverTimestamp()
            }
          });
          
          chatDocRef = newChatRef;
        }
      } else {
        return; // Нет получателя для сообщения
      }
      
      await addDoc(collection(db, 'messages'), {
        chatId: chatDocRef.id,
        text: newMessage,
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        read: false
      });
      
      await updateDoc(chatDocRef, {
        lastMessage: {
          text: newMessage,
          senderId: currentUser.uid,
          timestamp: serverTimestamp()
        }
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!currentUser) return;
    
    if (window.confirm('Вы уверены, что хотите удалить это сообщение?')) {
      try {

        await deleteDoc(doc(db, 'messages', messageId));
        
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
      } catch (error) {
        console.error('Ошибка при удалении сообщения:', error);
        alert('Не удалось удалить сообщение. Пожалуйста, попробуйте снова.');
      }
    }
  };

  const goToUserProfile = () => {
    if (otherUser) {
      navigate(`/profile/${otherUser.uid}`);
    }
  };

  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Заголовок чата */}
      <div className="p-4 border-b border-gray-200 flex items-center">
        {isMobile && onBackToList && (
          <button 
            onClick={onBackToList}
            className="mr-2 text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        
        {otherUser ? (
          <div 
            className="flex items-center cursor-pointer hover:opacity-80 flex-1 min-w-0"
            onClick={goToUserProfile}
          >
            {otherUser.photoURL ? (
              <img 
                src={otherUser.photoURL} 
                alt={otherUser.displayName || 'Пользователь'} 
                className="h-10 w-10 rounded-full mr-3 flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0">
                <UserIcon className="h-5 w-5 text-gray-500" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-gray-900 hover:underline truncate">
                {otherUser.displayName || 'Пользователь'}
              </h2>
              <p className="text-xs text-gray-500 truncate">
                Нажмите, чтобы перейти в профиль
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0">
              <UserIcon className="h-5 w-5 text-gray-500" />
            </div>
            <h2 className="text-lg font-medium text-gray-900 truncate">
              Загрузка...
            </h2>
          </div>
        )}
      </div>
      
      {/* Сообщения */}
      <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
        {messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map(message => {
              const isCurrentUser = message.senderId === currentUser.uid;
              
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs sm:max-w-md px-4 py-2 rounded-lg ${
                      isCurrentUser 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-800'
                    } relative group break-words`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {message.timestamp && (
                      <p className={`text-xs mt-1 ${isCurrentUser ? 'text-indigo-200' : 'text-gray-500'}`}>
                        {formatDate(message.timestamp.toDate())}
                      </p>
                    )}
                    
                    {isCurrentUser && (
                      <button 
                        onClick={() => deleteMessage(message.id)}
                        className="absolute -right-6 top-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить сообщение"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">
              {chatId 
                ? 'Нет сообщений. Начните общение!' 
                : 'Начните новый чат с этим пользователем'}
            </p>
          </div>
        )}
      </div>
      
      {/* Форма отправки сообщения */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Введите сообщение..."
            className="flex-1 border border-gray-300 rounded-l-md py-2 px-4 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-md px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow; 