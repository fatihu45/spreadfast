import { failedUploadFiles } from './failedUploadFiles';
test('partial uploads retry only failed entries even when names repeat', () => {
  const files = [new File(['a'], 'brief.pdf'), new File(['b'], 'brief.pdf')];
  expect(failedUploadFiles(files, {success:true, errors:[{file:'brief.pdf',fileIndex:1}]})).toEqual([files[1]]);
  expect(failedUploadFiles(files, {success:true})).toEqual([]);
  expect(failedUploadFiles(files, {success:false})).toEqual(files);
});
