exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { company, problem, name, city } = body;
  if (!company || !problem) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'API key not configured' };
  }

  const prompt = `Write a formal complaint letter from a consumer to a company.

Company: ${company}
Problem: ${problem}
${name ? `Consumer name: ${name}` : ''}
${city ? `Consumer location: ${city}` : ''}

The letter should:
1. Be firm, professional, and specific
2. Name the appropriate regulatory body to copy (e.g. CFPB for financial companies, FTC for deceptive practices, state insurance commissioner for insurance, FCC for telecom, state attorney general as appropriate)
3. State clearly what resolution is being requested
4. Include a deadline for response (14 business days is standard)
5. Be formatted as a ready-to-send letter

Return only the letter text, no commentary before or after.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error('Anthropic API error: ' + response.status);
    }

    const data = await response.json();
    const letter = data.content[0].text;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Letter generation failed' };
  }
};
