import qiniu from 'qiniu';

interface MacAndToken {
  mac: qiniu.auth.digest.Mac;
  token: string;
}

export function genToken(bucket: string, ak: string, sk: string): MacAndToken {
  const mac = new qiniu.auth.digest.Mac(ak, sk);

  const putPolicy = new qiniu.rs.PutPolicy({
    scope: bucket,
  });
  const token = putPolicy.uploadToken(mac);
  return { mac, token };
}
