// api/generate.js
export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, prompt } = req.body;
    
    // 第一步：发送生成请求到 DreamO
    const generateResponse = await fetch('https://echovoca-dreamo-echovoca.hf.space/gradio_api/call/generate_image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HF_TOKEN}`
      },
      body: JSON.stringify({
        data: [
          {"path": imageUrl, "meta": {"_type": "gradio.FileData"}},
          "",
          "ip",
          "style",
          prompt || "romantic postcard watercolor style, soft pastel colors, dreamy atmosphere",
          "",
          1024,
          1024,
          512,
          12,
          4.5,
          1,
          0,
          0,
          "",
          3.5,
          0
        ]
      })
    });

    const generateData = await generateResponse.json();
    const eventId = generateData.event_id;

    // 等待 10 秒让 DreamO 生成图片
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 第二步：获取生成结果
    const resultResponse = await fetch(`https://echovoca-dreamo-echovoca.hf.space/gradio_api/call/generate_image/${eventId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`
      }
    });

    const resultText = await resultResponse.text();
    
    // 从返回文本中提取图片URL（简化处理）
    const lines = resultText.split('\n');
    let imageUrl = null;
    
    for (const line of lines) {
      if (line.includes('data:') && line.includes('http')) {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          if (data && data[0] && typeof data[0] === 'string' && data[0].startsWith('http')) {
            imageUrl = data[0];
            break;
          }
        } catch (e) {
          // 继续尝试下一行
        }
      }
    }

    if (imageUrl) {
      res.json({ success: true, imageUrl: imageUrl });
    } else {
      res.json({ success: false, error: 'No image generated' });
    }

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
