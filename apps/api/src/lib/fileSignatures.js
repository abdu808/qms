const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(buffer, signature) {
  return Buffer.isBuffer(buffer) && buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

export function detectFileKind(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (startsWith(buffer, PNG_SIGNATURE)) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (startsWith(buffer, OLE_SIGNATURE)) return 'ole-office';

  const zipHeader = buffer[0] === 0x50 && buffer[1] === 0x4b && (
    (buffer[2] === 0x03 && buffer[3] === 0x04) ||
    (buffer[2] === 0x05 && buffer[3] === 0x06) ||
    (buffer[2] === 0x07 && buffer[3] === 0x08)
  );
  if (zipHeader) return 'zip-office';

  return null;
}

export function isAllowedFileKind(buffer, allowedKinds) {
  const kind = detectFileKind(buffer);
  return Boolean(kind && allowedKinds.includes(kind));
}

export function isExcelFile(buffer) {
  return isAllowedFileKind(buffer, ['zip-office', 'ole-office']);
}
