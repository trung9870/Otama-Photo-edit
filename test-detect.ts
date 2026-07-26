async function test() {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    console.error("No KIE_API_KEY");
    return;
  }

  try {
    const response = await fetch('https://api.kie.ai/gemini-3-5-flash-openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3.5-flash',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    console.log("Success:", data?.choices?.[0]?.message?.content);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
