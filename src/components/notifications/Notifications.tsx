import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { BellIcon, HeartIcon, ChatBubbleLeftIcon, UserIcon } from '@heroicons/react/24/outline';
import mysqlService from '../../services/mysqlService';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'message';
  isRead: boolean;
  createdAt: string;
  sender: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
  referenceId: string;
  message?: string;
}

const Notifications = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    mysqlService.getNotifications()
      .then((data) => {
        setNotifications(data);
        setLoading(false);
      })
      .catch(() => {
        setNotifications([]);
        setLoading(false);
      });
  }, [currentUser]);

  // Группировка сообщений: если есть несколько непрочитанных сообщений от одного пользователя — показываем как одно уведомление
  const groupedNotifications = useMemo(() => {
    const result: Notification[] = [];
    const messageMap = new Map<string, Notification>();
    for (const n of notifications) {
      if (n.type === 'message' && !n.isRead) {
        // Ключ — отправитель
        if (!messageMap.has(n.sender.uid)) {
          messageMap.set(n.sender.uid, n);
        }
      } else {
        result.push(n);
      }
    }
    // Добавляем сгруппированные сообщения
    result.push(...Array.from(messageMap.values()));
    // Сортируем по дате
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await mysqlService.markNotificationAsRead(notificationId);
      setNotifications((prev) => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    } catch (error) {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    const unread = groupedNotifications.filter(n => !n.isRead);
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ru });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <HeartIcon className="h-6 w-6 text-red-500" />;
      case 'comment':
        return <ChatBubbleLeftIcon className="h-6 w-6 text-blue-500" />;
      case 'follow':
        return <UserIcon className="h-6 w-6 text-green-500" />;
      case 'message':
        return <ChatBubbleLeftIcon className="h-6 w-6 text-purple-500" />;
      default:
        return <BellIcon className="h-6 w-6 text-gray-500" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return `поставил(а) лайк на вашу публикацию`;
      case 'comment':
        return `оставил(а) комментарий: "${notification.message || ''}"`;
      case 'follow':
        return `подписался(ась) на вас`;
      case 'message':
        return `отправил(а) вам сообщение`;
      default:
        return 'взаимодействовал(а) с вами';
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
      case 'comment':
        return `/post/${notification.referenceId}`;
      case 'follow':
        return `/profile/${notification.sender.uid}`;
      case 'message':
        return `/messages`;
      default:
        return '/';
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Доступ запрещен</h2>
          <p className="mt-2 text-gray-600">Вы должны войти в систему, чтобы просматривать уведомления.</p>
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Уведомления</h1>
        {groupedNotifications.some(notification => !notification.isRead) && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Отметить все как прочитанные
          </button>
        )}
      </div>

      {groupedNotifications.length > 0 ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {groupedNotifications.map(notification => (
              <li 
                key={notification.id}
                className={`p-4 hover:bg-gray-50 ${!notification.isRead ? 'bg-indigo-50' : ''}`}
              >
                <Link 
                  to={getNotificationLink(notification)}
                  onClick={() => !notification.isRead && markAsRead(notification.id)}
                  className="flex items-start space-x-3"
                >
                  <div className="flex-shrink-0">
                    {notification.sender.photoURL ? (
                      <img 
                        src={notification.sender.photoURL} 
                        alt={notification.sender.displayName || 'Пользователь'} 
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 font-bold">
                          {notification.sender.displayName?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="font-bold">{notification.sender.displayName || 'Пользователь'}</span>{' '}
                        {getNotificationText(notification)}
                      </p>
                      <div className="ml-2 flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Нет уведомлений</h3>
          <p className="mt-2 text-gray-500">
            У вас пока нет уведомлений. Они появятся, когда кто-то будет взаимодействовать с вашим контентом.
          </p>
        </div>
      )}
    </div>
  );
};

export default Notifications; 