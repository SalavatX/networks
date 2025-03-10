import { useState, useRef } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { db, auth, storage } from '../../firebase/config';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { UserIcon } from '@heroicons/react/24/outline';
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

interface EditProfileProps {
  profileData: ProfileData;
  onClose: () => void;
  onUpdate: (updatedData: Partial<ProfileData>) => void;
}

const EditProfile = ({ profileData, onClose, onUpdate }: EditProfileProps) => {
  const { currentUser } = useAuth();
  const [displayName, setDisplayName] = useState(profileData.displayName || '');
  const [bio, setBio] = useState(profileData.bio || '');
  const [photoURL, setPhotoURL] = useState(profileData.photoURL || '');
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(photoURL);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPhoto(file);
      
      // Создаем URL для предпросмотра
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    
    try {
      let updatedPhotoURL = photoURL;
      
      // Если есть новое фото, загружаем его
      if (newPhoto) {
        try {
          // Создаем путь для хранения фото профиля
          const storageRef = storage.ref(`users/${profileData.uid}`);
          // Загружаем файл
          const uploadTask = await storageRef.put(newPhoto);
          // Получаем URL загруженного файла
          updatedPhotoURL = await uploadTask.ref.getDownloadURL();
        } catch (error) {
          console.error('Ошибка при загрузке фото:', error);
          // Если не удалось загрузить фото, продолжаем с текущим URL
        }
      }
      
      // Обновляем данные в Firestore
      const userDocRef = doc(db, 'users', profileData.uid);
      const updatedData = {
        displayName,
        bio,
        photoURL: updatedPhotoURL
      };
      
      await updateDoc(userDocRef, updatedData);
      
      // Обновляем профиль в Firebase Auth
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName,
          photoURL: updatedPhotoURL
        });
        
        // Обновление currentUser произойдет автоматически через onAuthStateChanged
        // в AuthContext, поэтому нам не нужно вызывать setCurrentUser
      }
      
      // Обновляем все посты пользователя с новым именем и фото
      try {
        const postsRef = collection(db, 'posts');
        const postsQuery = query(postsRef, where('authorId', '==', profileData.uid));
        const postsSnapshot = await getDocs(postsQuery);
        
        // Обновляем каждый пост
        const batch = writeBatch(db);
        postsSnapshot.docs.forEach(postDoc => {
          batch.update(postDoc.ref, {
            authorName: displayName,
            authorPhotoURL: updatedPhotoURL
          });
        });
        
        await batch.commit();
      } catch (error) {
        console.error('Ошибка при обновлении постов:', error);
        // Продолжаем выполнение даже при ошибке обновления постов
      }
      
      // Уведомляем родительский компонент об обновлении
      onUpdate(updatedData);
      onClose();
      
    } catch (error) {
      console.error('Ошибка при обновлении профиля:', error);
      setError('Не удалось обновить профиль. Пожалуйста, попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Редактировать профиль
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          {/* Фото профиля */}
          <div className="mb-4 flex flex-col items-center">
            <div className="relative">
              {photoPreview ? (
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 font-bold text-xl">
                    {displayName.charAt(0) || 'U'}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-indigo-600 rounded-full p-2 text-white shadow-md hover:bg-indigo-700"
              >
                <PhotoIcon className="h-4 w-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Нажмите на иконку, чтобы изменить фото профиля
            </p>
          </div>
          
          {/* Имя пользователя */}
          <div className="mb-4">
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              Имя
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              required
            />
          </div>
          
          {/* Биография */}
          <div className="mb-4">
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
              О себе
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          {/* Кнопки действий */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile; 