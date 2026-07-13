// 正しくwav化した実録音で複数STT設定を比較。検証後に削除。
// 使い方: node stt-diag3.js C:/tmp/m2.wav
require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const { SpeechClient } = require('@google-cloud/speech').v2;

const wavPath = process.argv[2];
const projectId = process.env.PROJECT_ID || 'yorisoi-medical';
const location = 'asia-northeast1';
const bucketName = process.env.GCS_BUCKET;
const storage = new Storage();
const client = new SpeechClient({ apiEndpoint: `${location}-speech.googleapis.com` });

const CASES = [
  { name: 'chirp_3+diar(現行)', model: 'chirp_3', diar: true },
  { name: 'chirp_3', model: 'chirp_3', diar: false },
  { name: 'chirp_2', model: 'chirp_2', diar: false },
  { name: 'long', model: 'long', diar: false },
];
function cfg(c){const f={enableAutomaticPunctuation:true};if(c.diar){f.enableWordTimeOffsets=true;f.diarizationConfig={minSpeakerCount:1,maxSpeakerCount:4};}return{autoDecodingConfig:{},model:c.model,languageCodes:['ja-JP'],features:f};}
function ext(resp){const r=Object.values(resp.results||{})[0];const a=r?.inlineResult?.transcript?.results||r?.transcript?.results||[];let w=0,t='';for(const x of a){const al=x.alternatives?.[0];if(al?.transcript)t+=al.transcript;if(al?.words)w+=al.words.length;}return{w,len:t.length,s:t.slice(0,100)};}

(async()=>{
  const dest=`diag/m2_${Date.now()}.wav`;
  await storage.bucket(bucketName).upload(wavPath,{destination:dest,contentType:'audio/wav'});
  const uri=`gs://${bucketName}/${dest}`;
  console.log('uri:',uri,'\n');
  for(const c of CASES){
    try{
      const [op]=await client.batchRecognize({recognizer:`projects/${projectId}/locations/${location}/recognizers/_`,config:cfg(c),files:[{uri}],recognitionOutputConfig:{inlineResponseConfig:{}}});
      const [resp]=await op.promise();
      const {w,len,s}=ext(resp);
      console.log(`[${c.name}] words=${w} len=${len}\n  ${s||'(空)'}\n`);
    }catch(e){console.log(`[${c.name}] ERROR: ${e.message}\n`);}
  }
  await storage.bucket(bucketName).file(dest).delete().catch(()=>{});
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
