import qiniu from 'qiniu';
import path from 'path';
import glob from 'glob';
import pAll from 'p-all';
import pRetry from 'p-retry';

function normalizePath(input: string): string {
  return input.replace(/^\//, '');
}

function putFile(
  // eslint-disable-next-line @typescript-eslint/camelcase
  uploader: qiniu.form_up.FormUploader,
  token: string,
  key: string,
  file: string,
  mac: qiniu.auth.digest.Mac,
  bucket: string,
  onProgress: (srcFile: string, destFile: string) => void,
  canOverwrite = false,
): Promise<{ file: string, to: string } | null> {
  const putExtra = new qiniu.form_up.PutExtra();
  // 使用Promise包装回调式API
  return new Promise<{ file: string, to: string } | null>((resolve, reject) => {
    uploader.putFile(token, key, file, putExtra, (err, body, info) => {
      if (err) {
        return reject(new Error(`Upload failed: ${file}`));
      }

      if (info.statusCode === 200) {
        onProgress(file, key);
        return resolve({
          file,
          to: key,
        });
      }

      if (info.statusCode === 614 && canOverwrite) {
        const options = {
          scope: `${bucket}:${key}`,
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        const overwriteToken = putPolicy.uploadToken(mac);
        putFile(uploader, overwriteToken, key, file, mac, bucket, onProgress, false)
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error(`Upload failed: ${file}`));
      }
    });
  });
}

export async function upload(
  bucket: string,
  mac: qiniu.auth.digest.Mac,
  token: string,
  srcDir: string,
  destDir: string,
  ignoreSourceMap: boolean,
  overwrite: boolean,
  onProgress: (srcFile: string, destFile: string) => void,
  onComplete: () => void,
  onFail: (errorInfo: any) => void,
): Promise<void> {
  const baseDir = path.resolve(process.cwd(), srcDir);
  const files = glob.sync(`${baseDir}/**/*`, { nodir: true });

  const config = new qiniu.conf.Config();

  const uploader = new qiniu.form_up.FormUploader(config);

  const tasks = files.map((file) => {
    const relativePath = path.relative(baseDir, path.dirname(file));
    const key = normalizePath(path.join(destDir, relativePath, path.basename(file)));

    if (ignoreSourceMap && file.endsWith('.map')) return null;

    const task = async (): Promise<any> => {
      // 使用Promise包装回调式API
      const result = new Promise<{ file: string, to: string } | null>((resolve, reject) => {
        putFile(uploader, token, key, file, mac, bucket, onProgress, overwrite)
          .then(resolve).catch(reject);
      });
      return result;
    };

    return () => pRetry(task, { retries: 5 });
  })
    .filter((item) => !!item) as (() => Promise<any>)[];

  const pAllRes = await pAll(tasks, { concurrency: 5, stopOnError: false });
  console.log({ pAllRes });
}
