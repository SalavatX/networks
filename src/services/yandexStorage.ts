import AWS from 'aws-sdk';

// Настройка S3 клиента для Яндекс.Облако с использованием переменных окружения
const s3 = new AWS.S3({
  endpoint: 'https://storage.yandexcloud.net',
  accessKeyId: import.meta.env.VITE_YANDEX_ACCESS_KEY_ID, // Из переменных окружения
  secretAccessKey: import.meta.env.VITE_YANDEX_SECRET_ACCESS_KEY, // Из переменных окружения
  region: 'ru-central1',
  s3ForcePathStyle: true,
  // Настройки для CORS
  httpOptions: {
    xhrWithCredentials: false
  }
});

// Имя вашего бакета в Яндекс.Облако из переменных окружения
const BUCKET_NAME = import.meta.env.VITE_YANDEX_BUCKET_NAME;

// Интерфейс, имитирующий Firebase Storage API
export const storage = {
  ref: (path: string) => ({
    put: async (file: File) => {
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const fullPath = path ? `${path}/${uniqueFileName}` : uniqueFileName;
      
      const params = {
        Bucket: BUCKET_NAME,
        Key: fullPath,
        Body: file,
        ContentType: file.type,
        // Разрешаем публичный доступ к файлу
        ACL: 'public-read'
        // Удалены настройки CORS, так как они должны быть на стороне сервера
      };

      try {
        console.log('Загрузка файла в Яндекс.Облако:', fullPath);
        const data = await s3.upload(params).promise();
        console.log('Файл успешно загружен:', data.Location);
        
        return {
          ref: {
            getDownloadURL: async () => data.Location
          }
        };
      } catch (error) {
        console.error('Ошибка при загрузке файла в Яндекс.Облако:', error);
        throw error;
      }
    },
    child: (childPath: string) => ({
      put: async (file: File) => {
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const fullPath = path 
          ? `${path}/${childPath}/${uniqueFileName}` 
          : `${childPath}/${uniqueFileName}`;
        
        const params = {
          Bucket: BUCKET_NAME,
          Key: fullPath,
          Body: file,
          ContentType: file.type,
          ACL: 'public-read'
          // Удалены настройки CORS, так как они должны быть на стороне сервера
        };

        try {
          console.log('Загрузка файла в Яндекс.Облако:', fullPath);
          const data = await s3.upload(params).promise();
          console.log('Файл успешно загружен:', data.Location);
          
          return {
            ref: {
              getDownloadURL: async () => data.Location
            }
          };
        } catch (error) {
          console.error('Ошибка при загрузке файла в Яндекс.Облако:', error);
          throw error;
        }
      }
    }),
    // Добавляем метод path для совместимости
    get path() {
      return path;
    }
  })
};

export default storage; 