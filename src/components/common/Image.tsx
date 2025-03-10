import { useState, useEffect } from 'react';
import { getFileFromFirestore } from '../../services/firestoreStorage';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

const Image = ({ src, alt, className = '', fallback = '', ...props }: ImageProps) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [loading, setLoading] = useState<boolean>(src.startsWith('firestore://'));
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const loadImage = async () => {
      if (src.startsWith('firestore://')) {
        try {
          setLoading(true);
          const base64Data = await getFileFromFirestore(src);
          setImageSrc(base64Data);
          setError(false);
        } catch (error) {
          console.error('Ошибка при загрузке изображения:', error);
          setError(true);
          if (fallback) {
            setImageSrc(fallback);
          }
        } finally {
          setLoading(false);
        }
      } else {
        setImageSrc(src);
      }
    };

    loadImage();
  }, [src, fallback]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error && !fallback) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <span className="text-gray-400">Ошибка загрузки</span>
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} {...props} />;
};

export default Image; 