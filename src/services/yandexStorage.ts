import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  endpoint: 'https://storage.yandexcloud.net',
  accessKeyId: import.meta.env.VITE_YANDEX_ACCESS_KEY_ID, 
  secretAccessKey: import.meta.env.VITE_YANDEX_SECRET_ACCESS_KEY, 
  region: 'ru-central1',
  s3ForcePathStyle: true,
  httpOptions: {
    xhrWithCredentials: false
  }
});

const BUCKET_NAME = import.meta.env.VITE_YANDEX_BUCKET_NAME;
console.log('BUCKET_NAME:', BUCKET_NAME);

export const yandexStorage = {
  upload: async (file: File, folder: string = 'uploads') => {
    const uniqueFileName = `${Date.now()}_${file.name}`;
    const Key = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
    const params = {
      Bucket: BUCKET_NAME,
      Key,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read',
    };
    try {
      const data = await s3.upload(params).promise();
      return data.Location as string;
    } catch (error) {
      console.error('Ошибка при загрузке файла в Яндекс.Облако:', error);
      throw error;
    }
  }
};

export default yandexStorage; 