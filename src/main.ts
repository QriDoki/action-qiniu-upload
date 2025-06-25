import * as core from '@actions/core';
import * as dotenv from 'dotenv';
import { genToken } from './token';
import { upload } from './upload';

dotenv.config();

async function run(): Promise<void> {
  try {
    const ak = core.getInput('access_key');
    const sk = core.getInput('secret_key');
    const bucket = core.getInput('bucket');
    const sourceDir = core.getInput('source_dir');
    const destDir = core.getInput('dest_dir');
    const ignoreSourceMap = core.getInput('ignore_source_map') === 'true';
    const overwrite = core.getInput('overwrite') === 'true';

    const { mac, token } = genToken(bucket, ak, sk);
    await upload(
      bucket,
      mac,
      token,
      sourceDir,
      destDir,
      ignoreSourceMap,
      overwrite,
      (file, key) => core.info(`Success: ${file} => [${bucket}]: ${key}`),
      () => core.info('Done!'),
      (error) => core.setFailed(error.message),
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run()
  .then(() => {
    console.log('Run function completed successfully.');
    // 可以在这里执行一些清理或退出操作
    process.exit(0); // 成功退出
  })
  .catch((error) => {
    console.error('Run function failed:', error.message);
    process.exit(1); // 失败退出
  });
