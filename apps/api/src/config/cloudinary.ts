import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate Cloudinary configuration
export const validateCloudinaryConfig = (): boolean => {
  const requiredVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing Cloudinary environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  console.log('✅ Cloudinary configuration validated');
  return true;
};

// Test Cloudinary connection
export const testCloudinaryConnection = async (): Promise<boolean> => {
  try {
    await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful');
    return true;
  } catch (error) {
    console.warn('⚠️ Cloudinary connection failed:', error);
    return false;
  }
};

export const uploadImage = async (file: string, folder: string = 'pharma-care') => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder,
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto' },
        { format: 'auto' }
      ]
    });
    return result;
  } catch (error) {
    throw new Error('Image upload failed');
  }
};

export const uploadDocument = async (file: string, folder: string = 'licenses', publicId?: string) => {
  try {
    const uploadOptions: any = {
      folder,
      resource_type: 'auto', // Handles both images and PDFs
      quality: 'auto',
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const result = await cloudinary.uploader.upload(file, uploadOptions);
    return result;
  } catch (error) {
    throw new Error('Document upload failed');
  }
};

export const deleteDocument = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'auto'
    });
    return result;
  } catch (error) {
    throw new Error('Document deletion failed');
  }
};

// Initialize Cloudinary validation on import
validateCloudinaryConfig();

export { cloudinary };