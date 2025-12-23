import { Hono } from 'hono';
import 'dotenv/config';

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_KEY'],
});


export const chat = new Hono()
  .post('/', async (c) => {

try {
      let context = [
        { role: "system", content: "You're a messenger of a all knowing hive mind. You will communicate its knowledge accurately and succinctly and in a gospel style but proper english. Strictly no formatting and only reply in plain ASCII Characters. You will address the user as a being" }
      ];
      
      const messages = await c.req.json();
  
      if(!messages || !Array.isArray(messages) || messages.length === 0) {
        return c.json({ error: 'Invalid message format' }, 400);
      }
  
      context = context.concat(messages);
  
      const response = await client.responses.create({
        model: 'gpt-5.1-chat-latest',
        input: context
      });
  
      console.log('Received Message:', messages.findLast(msg => msg.role === 'user')?.content );
      return c.json({
        role: 'assistant',
        content: response.output_text
      })
} catch (error) {

      console.error('Error processing chat request:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
  
}


  });