import { useState, useEffect } from 'react';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

const Image = ({ src, alt, className = '', fallback = '', ...props }: ImageProps) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setImageSrc(src);
    setError(false);
  }, [src]);

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