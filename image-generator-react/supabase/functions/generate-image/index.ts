/// <reference types="https://deno.land/x/deno/cli/rt/0.4.0/index.d.ts" />
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import OpenAI from "npm:openai"; // Import OpenAI library

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Define expected values for size and quality for validation/typing
type ImageSize = "1024x1024" | "1024x1792" | "1792x1024"; // Adjusted based on DALL-E 3 options
type ImageQuality = "standard" | "hd";

// Helper function to safely get environment variables
function getEnvVar(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

console.log("Hello from Functions!")

Deno.serve(async (req) => {
  // Ensure OPENAI_API_KEY is set
  try {
    getEnvVar("OPENAI_API_KEY");
  } catch (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check for POST method
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // --- Handle FormData --- 
    const formData = await req.formData();
    const prompt = formData.get('prompt') as string;
    let sizeInput = formData.get('size') as string | null;
    let qualityInput = formData.get('quality') as string | null;
    const background = formData.get('background') as string | null; // 'transparent' or 'opaque'
    
    // Although images are sent, OpenAI Generations API doesn't use them.
    // We can log that they were received if needed:
    const images = formData.getAll('image');
    if (images && images.length > 0) {
      console.log(`Received ${images.length} image(s). Note: Images are not used for the Generations API endpoint.`);
      // You could potentially process/store these images elsewhere if needed.
    }

    // --- Validate Inputs --- 
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- Prepare OpenAI API Parameters --- 
    // Map frontend sizes to valid DALL-E 3 sizes, default to 1024x1024
    let size: ImageSize = "1024x1024"; 
    if (sizeInput === "1024x1792" || sizeInput === "1792x1024") {
      size = sizeInput;
    } else if (sizeInput === "1024x1536") { // Map portrait from frontend
      size = "1024x1792";
    } else if (sizeInput === "1536x1024") { // Map landscape from frontend
      size = "1792x1024";
    } // size remains "1024x1024" for "auto", "1024x1024", or any other value
    
    // Default to standard quality if 'auto' or invalid
    const quality: ImageQuality = (qualityInput === 'high' || qualityInput === 'hd') ? 'hd' : 'standard';
    
    // Note: DALL-E 3 API doesn't have a direct 'transparent background' parameter.
    // Transparency usually needs to be handled post-generation or via prompt engineering.
    // We log the user's preference but don't pass a specific param for it.
    console.log(`User requested background: ${background ?? 'opaque'}`);
    

    // --- Call OpenAI Image Generation API --- 
    console.log(`Generating image with prompt: "${prompt}", Size: ${size}, Quality: ${quality}`);
    const response = await openai.images.generate({
      model: "dall-e-3", // Specify DALL-E 3 model
      prompt: prompt,
      n: 1, // Generate one image
      size: size,
      quality: quality,
      response_format: 'b64_json', // Request base64 encoded image
    });

    // --- Process Response --- 
    const imageUrl = response.data[0].b64_json;
    if (!imageUrl) {
        throw new Error("No image data found in OpenAI response");
    }

    // --- Return Result --- 
    return new Response(
      JSON.stringify({ b64_json: imageUrl }),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Error processing request:", error);
    // Try to return a more specific error message if available
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: `Failed to generate image: ${errorMessage}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-image' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
