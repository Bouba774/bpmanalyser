import { registerPlugin } from '@capacitor/core';

export interface SAFFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface SAFFolderResult {
  folderUri: string;
  folderName: string;
  files: SAFFile[];
}

export interface SAFRenameResult {
  success: boolean;
  error?: string;
}

export interface SAFFileContentResult {
  data: string; // base64 encoded
}

export interface SAFFolderPickerPlugin {
  pickFolder(): Promise<SAFFolderResult>;
  readFileContent(options: { uri: string }): Promise<SAFFileContentResult>;
  renameFile(options: { uri: string; newName: string }): Promise<SAFRenameResult>;
}

const SAFFolderPicker = registerPlugin<SAFFolderPickerPlugin>('SAFFolderPicker');

export default SAFFolderPicker;
