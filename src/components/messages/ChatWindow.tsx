import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { PaperAirplaneIcon, UserIcon, ArrowLeftIcon, TrashIcon, DocumentIcon, PaperClipIcon } from '@heroicons/react/24/solid';
import { yandexStorage } from '../../services/yandexStorage';

interface ChatUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

// Определяем локальный интерфейс сообщения для компонента
interface LocalMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  read: boolean;
  author?: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
  isDeleting?: boolean;
  fileUrl?: string;
  fileType?: 'image' | 'document';
}

// Вспомогательная функция для преобразования ApiMessage в LocalMessage
const convertApiMessageToLocal = (msg: any): LocalMessage => {
  // Определяем тип файла по расширению, если есть
  let fileType: 'image' | 'document' | undefined;
  if (msg.text && (msg.text.includes('http://') || msg.text.includes('https://'))) {
    const fileUrl = msg.text.trim();
    const lowercaseUrl = fileUrl.toLowerCase();
    if (lowercaseUrl.endsWith('.jpg') || lowercaseUrl.endsWith('.jpeg') || 
        lowercaseUrl.endsWith('.png') || lowercaseUrl.endsWith('.gif') || 
        lowercaseUrl.endsWith('.webp')) {
      fileType = 'image';
    } else if (lowercaseUrl.endsWith('.pdf') || lowercaseUrl.endsWith('.doc') || 
              lowercaseUrl.endsWith('.docx') || lowercaseUrl.endsWith('.txt') || 
              lowercaseUrl.endsWith('.zip')) {
      fileType = 'document';
    }
  }

  return {
    id: msg.id,
    text: msg.text || '',
    senderId: msg.senderId || '',
    createdAt: msg.createdAt,
    read: msg.read || false,
    fileUrl: fileType ? msg.text : undefined,
    fileType
  };
};

interface ChatWindowProps {
  chatId: string | null;
  currentUser: any;
  otherUser: ChatUser | null;
  onBackToList?: () => void;
}

// Вспомогательная функция для нормализации пути к файлу
function normalizeFileUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  // Если уже полный URL, возвращаем как есть
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
  // Удаляем лишние /uploads/
  return fileUrl.replace(/(\\)?(uploads\\)+/g, '/uploads/').replace(/\\/g, '/').replace(/(\/)+/g, '/');
}

const ChatWindow = ({ currentUser, otherUser, onBackToList }: ChatWindowProps) => {
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const checkMessagesInterval = useRef<NodeJS.Timeout | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Функция для получения сообщений
  const fetchMessages = async () => {
    if (!otherUser) return;
    
    try {
      const messagesData = await mysqlService.getMessages(otherUser.uid);
      console.log('Ответ сервера (messagesData):', messagesData);
      // Преобразуем сообщения с сервера в локальный формат
      const serverMessages = messagesData.map(convertApiMessageToLocal);
      
      // Обновляем только статусы прочтения и добавляем новые сообщения
      setMessages(prevMessages => {
        // Создаем новый массив
        const updatedMessages = [...prevMessages];
        
        // Добавляем новые сообщения от сервера
        for (const serverMsg of serverMessages) {
          const existingMsgIndex = updatedMessages.findIndex(msg => msg.id === serverMsg.id);
          
          if (existingMsgIndex >= 0) {
            // Обновляем только статус прочтения для существующих сообщений
            updatedMessages[existingMsgIndex] = {
              ...updatedMessages[existingMsgIndex],
              read: serverMsg.read
            };
          } else {
            // Добавляем новое сообщение
            updatedMessages.push(serverMsg);
          }
        }
        
        // Удаляем временные сообщения, если их ID больше не существует на сервере
        // (это нужно, только если они были отправлены с другого устройства)
        const finalMessages = updatedMessages.filter(msg => 
          !msg.id.startsWith('temp-') || 
          !serverMessages.some(serverMsg => serverMsg.senderId === msg.senderId && 
            Math.abs(new Date(serverMsg.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 10000)
        );
        
        // Сортируем сообщения по времени
        finalMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        return finalMessages;
      });
    } catch (error) {
      console.error('Ошибка при загрузке сообщений:', error);
      setError('Не удалось загрузить сообщения. Пожалуйста, попробуйте позже.');
    }
  };

  // Загрузка сообщений при изменении пользователя
  useEffect(() => {
    if (!otherUser) return;
    
    setLoading(true);
    setError(null);
    
    fetchMessages().finally(() => {
        setLoading(false);
    });
    
    // Настраиваем периодическую проверку новых сообщений
    checkMessagesInterval.current = setInterval(fetchMessages, 3000);
    
    return () => {
      if (checkMessagesInterval.current) {
        clearInterval(checkMessagesInterval.current);
        }
    };
  }, [otherUser]);

  // Прокрутка к последнему сообщению
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Функция для отправки сообщения
  const sendMessage = async () => {
    if (!newMessage.trim() || !otherUser) return;
    
    const messageText = newMessage.trim();
    setNewMessage('');
    
    try {
      // Отображаем сообщение локально сразу
      const tempId = `temp-${Date.now()}`;
      const tempMessage: LocalMessage = {
        id: tempId,
        text: messageText,
              senderId: currentUser.uid,
        createdAt: new Date().toISOString(),
        read: false,
        author: {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL
        }
      };
      
      // Добавляем временное сообщение для моментальной обратной связи
      setMessages(prev => [...prev, tempMessage]);
      
      // Отправляем сообщение на сервер
      const sentMessageData = await mysqlService.sendMessage(otherUser.uid, messageText);
      
      // Заменяем временное сообщение на настоящее, сохраняя текст
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { 
              ...msg,
              id: sentMessageData.id,
              createdAt: sentMessageData.createdAt || msg.createdAt,
            } 
          : msg
      ));
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      
      // Удаляем временное сообщение в случае ошибки
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
      alert('Не удалось отправить сообщение. Пожалуйста, попробуйте снова.');
    }
  };

  // Переход к профилю пользователя
  const goToUserProfile = () => {
    if (otherUser) {
      navigate(`/profile/${otherUser.uid}`);
    }
  };

  // Формат времени сообщения
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  };

  // Обработка нажатия Enter для отправки сообщения
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Функция для удаления сообщения
  const deleteMessage = async (messageId: string) => {
    try {
      // Показываем визуальный эффект удаления сразу
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isDeleting: true } 
          : msg
      ));
      
      // Вызываем API для удаления сообщения
      await mysqlService.deleteMessage(messageId);
      
      // Удаляем сообщение из локального состояния
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Сбрасываем выбранное сообщение
      setSelectedMessage(null);
    } catch (error) {
      console.error('Ошибка при удалении сообщения:', error);
      
      // Убираем эффект удаления в случае ошибки
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isDeleting: false } 
          : msg
      ));
      
      alert('Не удалось удалить сообщение. Пожалуйста, попробуйте снова.');
    }
  };

  // Обработчик долгого нажатия/клика на сообщение
  const handleMessageAction = (messageId: string, isOwnMessage: boolean) => {
    if (isOwnMessage) {
      setSelectedMessage(prevId => prevId === messageId ? null : messageId);
    }
  };

  // Функция для загрузки файла
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !otherUser) return;
    
    const file = files[0];
    setIsUploading(true);
    
    try {
      // Загружаем файл в Яндекс.Облако
      const fileUrl = await yandexStorage.upload(file, 'messages');
      if (fileUrl) {
        // Отображаем сообщение локально сразу
        const tempId = `temp-${Date.now()}`;
        const tempMessage: LocalMessage = {
          id: tempId,
          text: fileUrl,
          senderId: currentUser.uid,
          createdAt: new Date().toISOString(),
          read: false,
          author: {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
          },
          fileUrl,
          fileType: file.name.toLowerCase().endsWith('.jpg') || 
                   file.name.toLowerCase().endsWith('.jpeg') || 
                   file.name.toLowerCase().endsWith('.png') || 
                   file.name.toLowerCase().endsWith('.gif') || 
                   file.name.toLowerCase().endsWith('.webp') 
                   ? 'image' : 'document'
        };
        
        // Добавляем временное сообщение для моментальной обратной связи
        setMessages(prev => [...prev, tempMessage]);
        
        // Отправляем сообщение на сервер
        const sentMessageData = await mysqlService.sendMessage(otherUser.uid, fileUrl);
        
        // Заменяем временное сообщение на настоящее, сохраняя данные файла
        setMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { 
                ...msg,
                id: sentMessageData.id,
                createdAt: sentMessageData.createdAt || msg.createdAt,
              } 
            : msg
        ));
      }
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      alert('Не удалось загрузить файл. Пожалуйста, попробуйте снова.');
    } finally {
      setIsUploading(false);
      // Очищаем input для возможности повторной загрузки того же файла
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Функция открытия диалога выбора файла
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
  }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Заголовок с пользователем */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center">
        {isMobile && onBackToList && (
          <button 
            onClick={onBackToList}
            className="mr-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        
        <div className="flex-1 flex items-center" onClick={goToUserProfile}>
          {otherUser?.photoURL ? (
              <img 
                src={otherUser.photoURL} 
                alt={otherUser.displayName || 'Пользователь'} 
              className="h-10 w-10 rounded-full mr-3 cursor-pointer"
              />
            ) : (
            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3 cursor-pointer">
              <UserIcon className="h-6 w-6 text-gray-600" />
            </div>
          )}
          <div>
            <h2 className="font-medium text-gray-900 cursor-pointer">
              {otherUser?.displayName || 'Пользователь'}
            </h2>
          </div>
        </div>
      </div>
      
      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-2">{error}</p>
            <button 
              onClick={goToUserProfile}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Перейти к профилю пользователя
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">
              У вас пока нет сообщений с этим пользователем.
            </p>
            <p className="text-gray-500 mb-4">
              Начните диалог, отправив первое сообщение.
            </p>
          </div>
        ) : (
          messages.map(message => {
              const isCurrentUser = message.senderId === currentUser.uid;
              
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                  className={`relative max-w-[70%] px-4 py-2 rounded-lg ${
                      isCurrentUser 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                  } ${message.isDeleting ? 'opacity-50' : ''}`}
                  onClick={() => handleMessageAction(message.id, isCurrentUser)}
                >
                  {/* Показываем кнопку удаления для выбранного сообщения */}
                  {selectedMessage === message.id && isCurrentUser && (
                    <div className="absolute -top-8 right-0 bg-white rounded-lg shadow-md p-1 z-10">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMessage(message.id);
                        }}
                        className="text-red-600 hover:text-red-800 focus:outline-none p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    )}
                  
                  {/* Отображение содержимого сообщения в зависимости от типа */}
                  {message.fileType === 'image' ? (
                    <div>
                      <img 
                        src={normalizeFileUrl(message.fileUrl || '')} 
                        alt="Изображение" 
                        className="max-w-full rounded-lg mb-2 max-h-[300px] object-contain"
                        loading="lazy"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(normalizeFileUrl(message.fileUrl || ''), '_blank');
                        }}
                      />
                      <p className="text-xs">Изображение</p>
                    </div>
                  ) : message.fileType === 'document' ? (
                    <div 
                      className="flex items-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(normalizeFileUrl(message.fileUrl || ''), '_blank');
                      }}
                    >
                      <DocumentIcon className={`h-8 w-8 ${isCurrentUser ? 'text-white' : 'text-gray-700'} mr-2`} />
                      <div className="overflow-hidden">
                        <p className="text-sm truncate">Документ</p>
                        <p className="text-xs truncate">{message.text.split('/').pop()}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm break-words">{message.text}</p>
                  )}
                  
                  <p className={`text-xs mt-1 ${isCurrentUser ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {formatDate(message.createdAt)}
                    {isCurrentUser && (
                      <span className="ml-2">
                        {message.read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </p>
                  </div>
                </div>
              );
          })
        )}
            <div ref={messagesEndRef} />
      </div>
      
      {/* Ввод сообщения с добавленной кнопкой для загрузки файлов */}
      <div className="px-4 py-3 bg-gray-50 border-t">
        <div className="flex items-center">
          <button
            onClick={openFileDialog}
            disabled={isUploading}
            className={`p-2 rounded-full mr-2 ${
              isUploading 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            <PaperClipIcon className="h-5 w-5" />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          />
          
          <textarea
            rows={1}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            placeholder={isUploading ? "Загрузка файла..." : "Введите сообщение..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isUploading}
          />
          
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isUploading}
            className={`ml-2 p-2 rounded-full ${
              !newMessage.trim() || isUploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
        
        {isUploading && (
          <div className="mt-2 text-center">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500 mr-2"></div>
              <span className="text-sm text-gray-600">Загрузка файла...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow; 