import AWS from 'aws-sdk';

// Настройка S3 клиента для Яндекс.Облако
// Замените эти значения на ваши собственные из Яндекс.Облако
const s3 = new AWS.S3({
  endpoint: 'https://storage.yandexcloud.net',
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  region: 'ru-central1',
  s3ForcePathStyle: true
});

// Имя вашего бакета в Яндекс.Облако
const BUCKET_NAME = 'your-bucket-name';

// Интерфейс, имитирующий Firebase Storage API
export const storage = {
  ref: (path: string) => ({
    put: async (file: File) => {
      const params = {
        Bucket: BUCKET_NAME,
        Key: path + '/' + file.name,
        Body: file,
        ContentType: file.type
      };

      try {
        const data = await s3.upload(params).promise();
        return {
          ref: {
            getDownloadURL: async () => data.Location
          }
        };
      } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        throw error;
      }
    },
    child: (childPath: string) => ({
      put: async (file: File) => {
        const fullPath = path + '/' + childPath;
        const params = {
          Bucket: BUCKET_NAME,
          Key: fullPath + '/' + file.name,
          Body: file,
          ContentType: file.type
        };

        try {
          const data = await s3.upload(params).promise();
          return {
            ref: {
              getDownloadURL: async () => data.Location
            }
          };
        } catch (error) {
          console.error('Ошибка при загрузке файла:', error);
          throw error;
        }
      }
    })
  }),
  // Другие методы, которые могут понадобиться
};

export default storage; 