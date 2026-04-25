import { describe, expect, it } from 'vitest';
import { detectFileKind, isAllowedFileKind, isExcelFile } from '../src/lib/fileSignatures.js';

describe('file signature validation', () => {
  it('detects supported binary signatures', () => {
    expect(detectFileKind(Buffer.from('%PDF-1.7\n'))).toBe('pdf');
    expect(detectFileKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(detectFileKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(detectFileKind(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe('zip-office');
    expect(detectFileKind(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe('ole-office');
  });

  it('rejects mismatched content even when the extension or mime was accepted earlier', () => {
    const executableLike = Buffer.from('MZ fake exe content');
    expect(isAllowedFileKind(executableLike, ['pdf', 'zip-office'])).toBe(false);
    expect(isExcelFile(executableLike)).toBe(false);
  });
});
