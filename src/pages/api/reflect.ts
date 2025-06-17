import type { VercelRequest, VercelResponse } from 'vercel';
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAIKEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { phrase, tone } = req.body;

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are Mirror Cartographer, an emotionally symbolic AI. Use a tone of ${tone}. Reflect on the phrase: ${phrase}`,
        },
      ],
    });

    const reflection = completion.data.choices[0].message?.content;
    res.status(200).json({ reflection });
  } catch (err) {
    console.error('GPT Error:', err);
    res.status(500).json({ error: 'Reflection failed.' });
  }
}

