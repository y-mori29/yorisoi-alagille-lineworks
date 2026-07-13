/**
 * よりそい PHR — visit 記録用ヘルパ
 * - 録音 (MediaRecorder) と /api/ai/transcribe ラッパ
 * - 写真 input → base64 変換
 * - /api/ai/parse-visit ラッパ
 *
 * liff-init.js が先に読まれている前提（apiPost / getDiseaseId 利用）
 */

const VisitRecorder = (() => {
  let mediaRecorder = null;
  let chunks = [];
  let stream = null;

  function pickMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (const t of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  async function startRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      throw new Error("既に録音中です");
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.start();
    return mimeType || mediaRecorder.mimeType;
  }

  function stopRecording() {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder) return reject(new Error("録音されていません"));
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        chunks = [];
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
        }
        resolve(blob);
      };
      mediaRecorder.onerror = (e) => reject(e.error || new Error("録音エラー"));
      mediaRecorder.stop();
    });
  }

  function isRecording() {
    return mediaRecorder && mediaRecorder.state === "recording";
  }

  function blobToDataUri(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function transcribeBlob(blob) {
    const dataUri = await blobToDataUri(blob);
    return apiPost("/api/ai/transcribe", { audio: dataUri });
  }

  async function parseVisitText(rawText, visitDate) {
    return apiPost("/api/ai/parse-visit", { rawText, visitDate });
  }

  function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return {
    startRecording,
    stopRecording,
    isRecording,
    transcribeBlob,
    parseVisitText,
    fileToDataUri,
  };
})();
