// api/generate.js
export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, prompt } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

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

    if (!generateResponse.ok) {
      throw new Error(`Generate request failed: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();
    const eventId = generateData.event_id;

    if (!eventId) {
      throw new Error('No event_id received from DreamO');
    }

    // 等待 15 秒让 DreamO 生成图片
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 第二步：获取生成结果
    const resultResponse = await fetch(`https://echovoca-dreamo-echovoca.hf.space/gradio_api/call/generate_image/${eventId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`
      }
    });

    if (!resultResponse.ok) {
      throw new Error(`Result request failed: ${resultResponse.status}`);
    }

    const resultText = await resultResponse.text();
    
    // 从返回文本中提取图片URL
    const lines = resultText.split('\n');
    let generatedImageUrl = null;
    
    for (const line of lines) {
      if (line.includes('data:') && line.includes('http')) {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          if (data && data[0] && typeof data[0] === 'string' && data[0].startsWith('http')) {
            generatedImageUrl = data[0];
            break;
          }
        } catch (e) {
          // 继续尝试下一行
          continue;
        }
      }
    }

    if (generatedImageUrl) {
      return res.json({ 
        success: true, 
        imageUrl: generatedImageUrl,
        eventId: eventId
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'No image generated',
        rawResponse: resultText.substring(0, 500) // 返回部分原始响应用于调试
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
