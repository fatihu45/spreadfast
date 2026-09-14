// The API reports each failed multipart entry by index (names may repeat).
export function failedUploadFiles(files, response) {
  if (!response.success) return files;
  if (!response.errors?.length) return [];
  return files.filter((file, index) => response.errors.some(error =>
    Number.isInteger(error.fileIndex) ? error.fileIndex === index : error.file === file.name));
}
