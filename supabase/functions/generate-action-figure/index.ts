import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('API key not configured');
    }
    const { prompt, quality, background, size } = await req.json();
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    console.log("Sending request to OpenAI with:", {
      prompt,
      quality,
      background,
      size
    });
    const openAIResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: size === 'auto' ? '1024x1024' : size,
        quality: quality || 'medium',
        background: background || 'opaque'
      })
    });
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', openAIResponse.status, errorText);
      throw new Error(`Error from OpenAI API: ${openAIResponse.status} ${errorText}`);
    }
    const responseData = await openAIResponse.json();
    console.log("OpenAI response received:", JSON.stringify(responseData).slice(0, 100) + "...");
    const imageBase64 = responseData.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error("No image data in response:", responseData);
      throw new Error('No image data returned from API');
    }
    return new Response(JSON.stringify({
      imageBase64
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in generate-action-figure function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
