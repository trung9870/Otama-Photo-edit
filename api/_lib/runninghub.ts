// RunningHub backend — wraps the 4 OpenAPI endpoints we use:
//   POST /task/openapi/upload     — upload image, get fileName URL
//   POST /task/openapi/create     — start workflow task, get taskId
//   POST /task/openapi/status     — query task status (QUEUED/RUNNING/SUCCESS/FAILED)
//   POST /task/openapi/outputs    — fetch result file URLs
//
// BYOK pattern: each handler takes clientApiKey from body, falls back to env RUNNINGHUB_API_KEY.

type Req = { body: any; query: any; method?: string };
type Res = {
  status: (code: number) => Res;
  json: (obj: any) => any;
  send: (data: any) => any;
  setHeader: (name: string, value: string) => any;
};

const RH_BASE = 'https://www.runninghub.ai';

function getKey(body: any): string | undefined {
  return body?.clientRunninghubApiKey || body?.apiKey || process.env.RUNNINGHUB_API_KEY;
}

function rhError(payload: any): string {
  if (!payload || typeof payload !== 'object') return 'Lỗi không rõ';
  const raw = payload.msg || payload.message || `code ${payload.code}`;
  return translateRhError(raw);
}

// Dịch các mã lỗi RunningHub thường gặp sang tiếng Việt
function translateRhError(raw: string): string {
  if (!raw) return 'Lỗi không rõ từ RunningHub';
  const s = raw.toUpperCase();
  if (s.includes('NOT_ENOUGH_POWER') || s.includes('INSUFFICIENT_POWER')) {
    return 'Tài khoản RunningHub hết power/credit. Vào runninghub.ai → User Center → Top up để mua thêm hoặc upgrade plan.';
  }
  if (s.includes('TASK_QUEUE_FULL') || s.includes('TOO_MANY_TASKS')) {
    return 'RunningHub đang quá tải task queue. Đợi vài phút rồi thử lại.';
  }
  if (s.includes('APIKEY_INVALID') || s.includes('UNAUTHORIZED') || s.includes('AUTH_FAIL')) {
    return 'API key RunningHub không hợp lệ. Vào Settings để kiểm tra lại key.';
  }
  if (s.includes('WORKFLOW_NOT_FOUND') || s.includes('WORKFLOW_NOT_EXIST')) {
    return 'Workflow ID không tồn tại trên RunningHub (có thể đã bị xoá hoặc set private).';
  }
  if (s.includes('NODE_INFO_MISMATCH')) {
    return `Cấu hình node sai (${raw}). Workflow có thể đã thay đổi cấu trúc — báo admin để cập nhật mapping.`;
  }
  if (s.includes('FILE_TOO_LARGE') || s.includes('SIZE_LIMIT')) {
    return 'File quá lớn so với giới hạn của RunningHub. Thử video/ảnh nhỏ hơn.';
  }
  if (s.includes('RATE_LIMIT') || s.includes('TOO_MANY_REQUESTS')) {
    return 'Đang gọi RunningHub quá nhanh. Đợi 30 giây rồi thử lại.';
  }
  return raw;
}

// =================================================================
// Upload image to RunningHub — returns the fileName URL to use in nodeInfoList
// Input: base64 string
// =================================================================
export async function uploadToRunninghub(base64: string, apiKey: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const form = new FormData();
  form.append('apiKey', apiKey);
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), `image-${Date.now()}.jpg`);
  form.append('fileType', 'image');

  const res = await fetch(`${RH_BASE}/task/openapi/upload`, {
    method: 'POST',
    headers: { 'Host': 'www.runninghub.ai' },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`RunningHub upload HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const data: any = await res.json();
  if (data?.code !== 0) throw new Error(`RunningHub upload: ${rhError(data)}`);
  // RH returns { data: { fileName: "api/..." } } — fileName is the URL fragment to use
  const fileName = data?.data?.fileName || data?.data?.url;
  if (!fileName) throw new Error('RunningHub không trả file URL');
  return fileName;
}

// =================================================================
// POST /api/runninghub/upload
// Body: { imageBase64, clientRunninghubApiKey? }
// =================================================================
export async function handleRunninghubUpload(req: Req, res: Res) {
  try {
    const apiKey = getKey(req.body);
    if (!apiKey) return res.status(401).json({ error: 'Thiếu API key RunningHub.' });
    const imageBase64: string | undefined = req.body?.imageBase64;
    if (!imageBase64) return res.status(400).json({ error: 'Thiếu imageBase64.' });
    const fileUrl = await uploadToRunninghub(imageBase64, apiKey);
    return res.json({ fileUrl });
  } catch (e: any) {
    console.error('[api] RunningHub upload error:', e);
    return res.status(500).json({ error: e?.message || 'Lỗi không rõ khi upload.' });
  }
}

// =================================================================
// POST /api/runninghub/run
// Body: { workflowId, nodeInfoList: [{nodeId, fieldName, fieldValue}], clientRunninghubApiKey? }
// Returns: { taskId, clientId }
// =================================================================
export async function handleRunninghubRun(req: Req, res: Res) {
  try {
    const apiKey = getKey(req.body);
    if (!apiKey) return res.status(401).json({ error: 'Thiếu API key RunningHub.' });
    const { workflowId, nodeInfoList } = req.body || {};
    if (!workflowId) return res.status(400).json({ error: 'Thiếu workflowId.' });

    const body = {
      apiKey,
      workflowId: String(workflowId),
      nodeInfoList: Array.isArray(nodeInfoList) ? nodeInfoList : [],
    };
    const r = await fetch(`${RH_BASE}/task/openapi/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Host': 'www.runninghub.ai' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(r.status).json({ error: `RunningHub create HTTP ${r.status}: ${errText.slice(0, 300)}` });
    }
    const data: any = await r.json();
    if (data?.code !== 0) {
      return res.status(400).json({ error: rhError(data), raw: data });
    }
    const taskId = data?.data?.taskId;
    const clientId = data?.data?.clientId || null;
    if (!taskId) return res.status(500).json({ error: 'RunningHub không trả taskId.', raw: data });
    return res.json({ taskId, clientId });
  } catch (e: any) {
    console.error('[api] RunningHub run error:', e);
    return res.status(500).json({ error: e?.message || 'Lỗi khi gọi RunningHub.' });
  }
}

// =================================================================
// POST /api/runninghub/status
// Body: { taskId, clientRunninghubApiKey? }
// Returns: { status: 'QUEUED'|'RUNNING'|'SUCCESS'|'FAILED', outputs?: string[], error? }
// =================================================================
export async function handleRunninghubStatus(req: Req, res: Res) {
  try {
    const apiKey = getKey(req.body);
    if (!apiKey) return res.status(401).json({ error: 'Thiếu API key RunningHub.' });
    const taskId: string | undefined = req.body?.taskId;
    if (!taskId) return res.status(400).json({ error: 'Thiếu taskId.' });

    // 1. Check status
    const sRes = await fetch(`${RH_BASE}/task/openapi/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Host': 'www.runninghub.ai' },
      body: JSON.stringify({ apiKey, taskId }),
    });
    if (!sRes.ok) {
      return res.status(sRes.status).json({ error: `Status HTTP ${sRes.status}` });
    }
    const sData: any = await sRes.json();
    if (sData?.code !== 0) {
      return res.json({ status: 'FAILED', error: rhError(sData) });
    }
    const status: string = String(sData?.data || 'QUEUED').toUpperCase();

    // 2. If not SUCCESS, return as-is
    if (status !== 'SUCCESS') {
      return res.json({ status });
    }

    // 3. SUCCESS → fetch outputs
    const oRes = await fetch(`${RH_BASE}/task/openapi/outputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Host': 'www.runninghub.ai' },
      body: JSON.stringify({ apiKey, taskId }),
    });
    if (!oRes.ok) {
      return res.json({ status: 'SUCCESS', outputs: [], error: `Outputs HTTP ${oRes.status}` });
    }
    const oData: any = await oRes.json();
    if (oData?.code !== 0) {
      return res.json({ status: 'SUCCESS', outputs: [], error: rhError(oData) });
    }
    // outputs shape: data: [{ fileUrl, fileType, ... }]
    const arr = Array.isArray(oData?.data) ? oData.data : [];
    const outputs = arr.map((x: any) => x?.fileUrl).filter((u: any) => typeof u === 'string' && u.length > 0);
    return res.json({ status: 'SUCCESS', outputs });
  } catch (e: any) {
    console.error('[api] RunningHub status error:', e);
    return res.status(500).json({ error: e?.message || 'Lỗi khi check status.' });
  }
}
