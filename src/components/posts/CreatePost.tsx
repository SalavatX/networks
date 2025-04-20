import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

const CreatePost = () => {
  const { currentUser, userData } = useAuth();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Ограничение на количество изображений (максимум 4)
      const newImages = [...images, ...filesArray].slice(0, 4);
      setImages(newImages);
      
      const newImagePreviewUrls = newImages.map(file => URL.createObjectURL(file));
      setImagePreviewUrls(newImagePreviewUrls);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);

    const newImagePreviewUrls = [...imagePreviewUrls];
    URL.revokeObjectURL(newImagePreviewUrls[index]); // Освобождаем URL
    newImagePreviewUrls.splice(index, 1);
    setImagePreviewUrls(newImagePreviewUrls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() && images.length === 0) return;
    if (!currentUser) return;
    
    setLoading(true);
    
    try {
      const imageUrls: string[] = [];
      
      if (images.length > 0) {
        for (const image of images) {
          try {
            const storageRef = storage.ref(`posts/${currentUser.uid}`);
            const uploadTask = await storageRef.put(image);
            const downloadURL = await uploadTask.ref.getDownloadURL();
            imageUrls.push(downloadURL);
          } catch (error) {
            console.error('Ошибка при загрузке изображения:', error);
          }
        }
      }
      
      await addDoc(collection(db, 'posts'), {
        content,
        imageUrls,
        authorId: currentUser.uid,
        authorName: userData?.displayName || 'Пользователь',
        authorPhotoURL: userData?.photoURL || '',
        createdAt: serverTimestamp(),
        likes: [],
        commentsCount: 0
      });
      
      setContent('');
      setImages([]);
      setImagePreviewUrls([]);
      
    } catch (error) {
      console.error('Ошибка при создании поста:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <form onSubmit={handleSubmit}>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {userData?.photoURL ? (
              <img 
                src={userData.photoURL} 
                alt="Profile" 
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 font-bold">
                  {userData?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <textarea
              rows={3}
              name="content"
              id="content"
              className="shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border border-gray-300 rounded-md p-2"
              placeholder="Что у вас нового?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            
            {imagePreviewUrls.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {imagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={url} 
                      alt={`Preview ${index}`} 
                      className="h-24 w-full object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-gray-800 bg-opacity-50 rounded-full p-1 text-white"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-3 flex items-center justify-between">
              <div>
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PhotoIcon className="h-5 w-5 mr-1 text-gray-500" />
                  Фото
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>
              <button
                type="submit"
                disabled={loading || (!content.trim() && images.length === 0)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreatePost; 