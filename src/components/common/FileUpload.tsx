import { useState, useRef } from 'react';
import { yandexStorage } from '../../services/yandexStorage';
import { PhotoIcon } from '@heroicons/react/24/outline';

interface FileUploadProps {
  onFileUpload: (url: string) => void;
  folder: string;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  buttonText?: string;
}

const FileUpload = ({
  onFileUpload,
  folder,
  accept = 'image/*',
  maxSizeMB = 5,
  className = '',
  buttonText = 'Загрузить файл'
}: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера файла
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`Файл слишком большой. Максимальный размер: ${maxSizeMB}MB`);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      
      const downloadURL = await yandexStorage.upload(file, folder);
      
      onFileUpload(downloadURL);
      
    
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      setError('Произошла ошибка при загрузке файла. Пожалуйста, попробуйте еще раз.');
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
      
      <button
        type="button"
        onClick={triggerFileInput}
        disabled={uploading}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <PhotoIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
        {uploading ? 'Загрузка...' : buttonText}
      </button>
      
      {uploading && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Загрузка: {progress}%</p>
        </div>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default FileUpload; 