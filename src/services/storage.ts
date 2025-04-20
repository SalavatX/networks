import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  endpoint: 'https://storage.yandexcloud.net',
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  region: 'ru-central1',
  s3ForcePathStyle: true
});

const BUCKET_NAME = 'your-bucket-name';

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
};

export default storage; 