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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'API key not configured' };
  }

  const { type, incident, sender, location } = body;
  if (!incident) {
    return { statusCode: 400, body: 'Missing incident data' };
  }

  let prompt = '';
  let max_tokens = 1200;

  if (type === 'letter') {
    prompt = 'You are an expert consumer advocate and complaint letter writer.\n\n'
      + 'Here is the full incident to write about:\n'
      + '- Company/Agency: ' + incident.company + '\n'
      + '- Category: ' + (incident.category || 'General') + '\n'
      + '- Full problem description: ' + incident.problem + '\n'
      + '- Time spent dealing with this: ' + (incident.hours > 0 ? incident.hours.toFixed(1) + ' hours' : 'not recorded') + '\n'
      + '- What worked (if anything): ' + (incident.solution || 'nothing yet') + '\n'
      + '- Status: ' + incident.resolved + '\n'
      + '- Letter sender name: ' + (sender || 'A Concerned Consumer') + '\n'
      + '- Sender location: ' + (location || 'United States') + '\n\n'
      + 'Write a firm, professional formal complaint letter that:\n'
      + '1. Clearly states what happened and when\n'
      + '2. Identifies the specific violation of consumer rights or reasonable expectations\n'
      + '3. Names the relevant regulatory body (e.g. CFPB for financial, state insurance commissioner for insurance, FTC for unfair practices, CMS for Medicare, state AG, California Department of Managed Health Care for CA insurance issues, etc.)\n'
      + '4. States a specific demand (refund, correction, written response within 30 days, etc.)\n'
      + '5. Mentions that a copy will be filed with the named regulator\n'
      + '6. Has a firm, professional tone\n\n'
      + 'Format as a complete formal letter. Output only the letter itself, no commentary before or after.';
    max_tokens = 1200;

  } else if (type === 'recipients') {
    prompt = 'Given this consumer complaint, list the 2-4 most appropriate recipients for a formal complaint letter.\n\n'
      + 'Company/Agency: ' + incident.company + '\n'
      + 'Category: ' + (incident.category || 'General') + '\n'
      + 'Problem: ' + incident.problem + '\n\n'
      + 'For each recipient, give: the name of the organization or office, a one-sentence explanation of why they are relevant, and if possible the general mailing address or submission URL.\n'
      + 'Format as a plain numbered list. Be specific. No preamble, no closing remarks.';
    max_tokens = 400;

  } else if (type === 'context') {
    prompt = 'A person logged this administrative complaint:\n\n'
      + 'Company/Agency: ' + incident.company + '\n'
      + 'Category: ' + (incident.category || 'General') + '\n'
      + 'Problem: ' + incident.problem + '\n\n'
      + 'Write 2-3 sentences of wider context. Cover why this problem structurally exists and what remedies exist. Tone: informed, clear, slightly wry. Plain prose, no bullets.';
    max_tokens = 300;

  } else {
    return { statusCode: 400, body: 'Unknown request type' };
  }

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
        max_tokens: max_tokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error('Anthropic API error: ' + response.status);
    }

    const data = await response.json();
    let text = '';
    if (data.content) {
      data.content.forEach(function(b) { if (b.text) text += b.text; });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter: text })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Request failed: ' + err.message };
  }
};
