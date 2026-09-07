const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

const RESPONSE_SCHEMA = {
  name: 'erp_sales_reply',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      reply: { type: 'string' },
      wantsRegistration: { type: 'boolean' },
    },
    required: ['reply', 'wantsRegistration'],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are a concise, friendly sales assistant for an ERP company.

Your job is to understand what the customer needs before offering a registration form.
- For greetings such as "hi", "hello", or "good morning", welcome them and ask one short question about what they need help with.
- Ask useful, short follow-up questions about their business, pain point, or ERP area when their need is unclear.
- Set wantsRegistration to true when the customer explicitly says they want an ERP product, ERP demo, ERP pricing/quotation, implementation, or to register/contact sales about ERP.
- A "yes", "sure", or equivalent affirmative answer to your immediately preceding ERP question is explicit confirmation that they want ERP. Set wantsRegistration to true.
- If you asked which ERP challenge they have and they name a requirement, such as project cost tracking, that also confirms ERP interest. Set wantsRegistration to true.
- A general greeting, casual chat, or a request for general information is not enough to send a registration form.
- When wantsRegistration is true, briefly tell them that you are sending the registration form now.
- Do not invent product features, prices, policies, or links. Keep the reply under 300 characters and use the customer's language where possible.

Return only the requested JSON object.`;

function isGreeting(text) {
  return /^(hi|hello|hey|good\s+(morning|afternoon|evening))\W*$/i.test(text.trim());
}

function getLatestInboundMessage(messages) {
  return [...messages].reverse().find((message) => message.direction === 'in');
}

function customerConfirmedErpInterest(messages) {
  const latestInboundIndex = [...messages].map((message) => message.direction).lastIndexOf('in');
  if (latestInboundIndex < 1) return false;

  const latestText = String(messages[latestInboundIndex].text || '').trim();
  const previousOutbound = [...messages.slice(0, latestInboundIndex)]
    .reverse()
    .find((message) => message.direction === 'out');
  const previousText = String(previousOutbound?.text || '');
  const isErpQuestion = /\berp\b/i.test(previousText) && /\?/i.test(previousText);
  const isNegative = /^(no|nope|not now|not interested)\b/i.test(latestText);
  const isAffirmative = /^(yes|yeah|yep|sure|okay|ok|interested|i am|i do)\b/i.test(latestText);
  const namesRequirement = /\b(challenges?|need|requirement|area|help)\b/i.test(previousText) && latestText.length > 2;

  return isErpQuestion && !isNegative && (isAffirmative || namesRequirement);
}

function fallbackReply(messages = []) {
  const latestInbound = getLatestInboundMessage(messages);
  const latestText = String(latestInbound?.text || '');

  if (customerConfirmedErpInterest(messages)) {
    return {
      reply: 'Thanks for confirming your ERP requirement. I am sending the registration form now.',
      wantsRegistration: true,
    };
  }

  if (isGreeting(latestText)) {
    return {
      reply: 'Hello! Welcome. Are you looking for an ERP solution for your business?',
      wantsRegistration: false,
    };
  }

  return {
    reply: 'Thanks for sharing that. Are you looking for an ERP solution, a demo, or pricing for your business?',
    wantsRegistration: false,
  };
}

function recentConversation(messages) {
  return messages
    .slice(-12)
    .map((message) => ({
      role: message.direction === 'out' ? 'assistant' : 'user',
      content: String(message.text || '').slice(0, 1200),
    }))
    .filter((message) => message.content.trim());
}

async function generateSalesReply(messages) {
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY is not configured. Sending the guided reply instead.');
    return fallbackReply(messages);
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      temperature: 0.2,
      max_completion_tokens: 180,
      response_format: {
        type: 'json_schema',
        json_schema: RESPONSE_SCHEMA,
      },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...recentConversation(messages)],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${details.slice(0, 500)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const decision = JSON.parse(content || '{}');
  const reply = String(decision.reply || '').trim();

  if (!reply || typeof decision.wantsRegistration !== 'boolean') {
    throw new Error('Groq returned an incomplete sales reply.');
  }

  return {
    reply: reply.slice(0, 1000),
    wantsRegistration: decision.wantsRegistration || customerConfirmedErpInterest(messages),
  };
}

module.exports = { customerConfirmedErpInterest, fallbackReply, generateSalesReply };
