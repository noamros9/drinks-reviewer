jest.mock('cloudinary', () => ({
  v2: { uploader: { upload: jest.fn(), destroy: jest.fn() } },
}));

const cloudinarySdk = require('cloudinary').v2;
const { uploadImage, deleteImage } = require('../cloudinary');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('uploadImage', () => {
  it('uploads the file with the given public_id and returns the secure_url', async () => {
    cloudinarySdk.uploader.upload.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/drinks/abc.png' });
    const url = await uploadImage('data:image/png;base64,xyz', 'drinks/abc');
    expect(url).toBe('https://res.cloudinary.com/demo/image/upload/v1/drinks/abc.png');
    expect(cloudinarySdk.uploader.upload).toHaveBeenCalledWith('data:image/png;base64,xyz', { public_id: 'drinks/abc' });
  });
});

describe('deleteImage', () => {
  it('derives the public_id from the secure_url and calls destroy', async () => {
    cloudinarySdk.uploader.destroy.mockResolvedValue({});
    await deleteImage('https://res.cloudinary.com/demo/image/upload/v1700000000/drinks/abc123.png');
    expect(cloudinarySdk.uploader.destroy).toHaveBeenCalledWith('drinks/abc123');
  });

  it('does nothing for a URL with no derivable public_id', async () => {
    await deleteImage(undefined);
    expect(cloudinarySdk.uploader.destroy).not.toHaveBeenCalled();
  });

  it('swallows a rejected destroy call', async () => {
    cloudinarySdk.uploader.destroy.mockRejectedValue(new Error('boom'));
    await expect(deleteImage('https://res.cloudinary.com/demo/image/upload/v1/drinks/abc.png')).resolves.toBeUndefined();
  });
});
