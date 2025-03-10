import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  HomeIcon, 
  ChatBubbleLeftRightIcon, 
  BellIcon, 
  UserIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const Navbar = () => {
  const { currentUser, userData, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                СоцСеть
              </Link>
            </div>
          </div>

          {currentUser && (
            <>
              {/* Desktop menu */}
              <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
                <Link to="/" className="text-gray-600 hover:text-indigo-600 p-2 rounded-md transition-colors">
                  <HomeIcon className="h-6 w-6" />
                </Link>
                <Link to="/messages" className="text-gray-600 hover:text-indigo-600 p-2 rounded-md transition-colors">
                  <ChatBubbleLeftRightIcon className="h-6 w-6" />
                </Link>
                <Link to="/notifications" className="text-gray-600 hover:text-indigo-600 p-2 rounded-md transition-colors">
                  <BellIcon className="h-6 w-6" />
                </Link>
                
                <Link to={`/profile/${currentUser.uid}`} className="text-gray-600 hover:text-indigo-600 p-2 rounded-md transition-colors">
                  {userData?.photoURL ? (
                    <img 
                      src={userData.photoURL} 
                      alt={userData.displayName || 'Пользователь'} 
                      className="h-8 w-8 rounded-full border-2 border-indigo-100"
                    />
                  ) : (
                    <UserIcon className="h-6 w-6" />
                  )}
                </Link>
                
                <button 
                  onClick={signOut} 
                  className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
                >
                  Выйти
                </button>
              </div>

              {/* Mobile menu button */}
              <div className="flex items-center sm:hidden">
                <button
                  onClick={toggleMenu}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-indigo-600 focus:outline-none transition-colors"
                >
                  {isMenuOpen ? (
                    <XMarkIcon className="block h-6 w-6" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && currentUser && (
        <div className="sm:hidden bg-white/90 backdrop-blur-md border-t border-gray-200">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
              onClick={toggleMenu}
            >
              <div className="flex items-center">
                <HomeIcon className="h-6 w-6 mr-3" />
                Главная
              </div>
            </Link>
            <Link
              to="/messages"
              className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
              onClick={toggleMenu}
            >
              <div className="flex items-center">
                <ChatBubbleLeftRightIcon className="h-6 w-6 mr-3" />
                Сообщения
              </div>
            </Link>
            <Link
              to="/notifications"
              className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
              onClick={toggleMenu}
            >
              <div className="flex items-center">
                <BellIcon className="h-6 w-6 mr-3" />
                Уведомления
              </div>
            </Link>
            <Link
              to={`/profile/${currentUser.uid}`}
              className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
              onClick={toggleMenu}
            >
              <div className="flex items-center">
                <UserIcon className="h-6 w-6 mr-3" />
                Профиль
              </div>
            </Link>
            <button
              onClick={() => {
                signOut();
                toggleMenu();
              }}
              className="block w-full text-left px-3 py-2 text-base font-medium text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 