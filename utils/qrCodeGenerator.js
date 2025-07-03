import QRCode from 'qrcode';

/**
 * Generates a QR code as a data URL for the given text
 * @param {string} text - The text/URL to encode in the QR code
 * @returns {Promise<string>} - A promise that resolves to the QR code data URL
 */
export const generateQRCode = async (text) => {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

/**
 * Generates a QR code as a buffer for the given text
 * @param {string} text - The text/URL to encode in the QR code
 * @returns {Promise<Buffer>} - A promise that resolves to the QR code buffer
 */
export const generateQRCodeBuffer = async (text) => {
  try {
    const qrCodeBuffer = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H',
      type: 'png',
      quality: 0.92,
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return qrCodeBuffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw error;
  }
}; 