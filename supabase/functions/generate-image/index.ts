// Required for Supabase functions
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; // Import Supabase client
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts"; // Import base64 decode
import { corsHeaders } from '../_shared/cors.ts'; // We'll create this helper
// Helper function to send JSON responses
const sendJSON = (data, status = 200, headers = {})=>{
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers
    },
    status: status
  });
};
// Helper to extract User ID from JWT
const getUserId = (req)=>{
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Missing or malformed Authorization header');
    return null;
  }
  try {
    const jwt = authHeader.substring(7); // Get token part after 'Bearer '
    const payloadB64Url = jwt.split('.')[1];
    if (!payloadB64Url) {
      throw new Error('Invalid JWT structure: Missing payload');
    }
    // Convert base64url to standard base64
    let payloadB64 = payloadB64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if necessary
    switch(payloadB64.length % 4){
      case 2:
        payloadB64 += '==';
        break;
      case 3:
        payloadB64 += '=';
        break;
    }
    // Decode standard base64 and then parse JSON
    const decodedPayloadString = new TextDecoder().decode(decode(payloadB64));
    const payload = JSON.parse(decodedPayloadString);
    return payload.sub || null; // 'sub' usually contains the user ID
  } catch (error) {
    console.error('Error decoding/parsing JWT payload:', error);
    return null;
  }
};
console.log("generate-image function initializing (Base Generation Only)");
serve(async (req)=>{
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // --- Create Supabase Admin Client ---
  let supabaseAdmin;
  try {
    supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    console.log("Supabase admin client initialized.");
  } catch (e) {
    console.error("Error initializing Supabase client:", e);
    return sendJSON({
      error: "Internal Server Error: Failed to initialize Supabase client"
    }, 500);
  }
  // --- Get User ID ---
  const userId = getUserId(req);
  if (!userId) {
    return sendJSON({
      error: 'Unauthorized: Missing or invalid user token'
    }, 401);
  }
  console.log(`Authenticated User ID: ${userId}`);
  try {
    // Log the received Authorization header for debugging
    console.log('Received Authorization Header:', req.headers.get('Authorization'));
    // Ensure it's a POST request
    if (req.method !== 'POST') {
      return sendJSON({
        error: 'Method Not Allowed'
      }, 405);
    }
    // Parse the multipart/form-data request body
    let formData;
    try {
      // This function now expects FormData ONLY to get text fields
      formData = await req.formData();
    } catch (e) {
      const error = e;
      console.error("Failed to parse FormData:", error);
      return sendJSON({
        error: `Bad Request: ${error.message}`
      }, 400);
    }
    // --- Extract data (Text Only) ---
    const prompt = formData.get('prompt');
    const size = formData.get('size');
    const quality = formData.get('quality');
    // No longer expecting image files or reference map here
    // --- Input Validation ---
    if (!prompt || typeof prompt !== 'string') {
      return sendJSON({
        error: 'Missing or invalid "prompt" in form data'
      }, 400);
    }
    console.log(`Received prompt: ${prompt.substring(0, 100)}...`);
    if (size) console.log(`Received size: ${size}`);
    if (quality) console.log(`Received quality: ${quality}`);
    // Get the OpenAI API key from environment variables (secrets)
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      console.error("OPENAI_API_KEY environment variable not set!");
      return sendJSON({
        error: 'Internal Server Error: Missing API configuration'
      }, 500);
    }
    // --- Always use GENERATIONS endpoint ---
    const openAIEndpoint = 'https://api.openai.com/v1/images/generations';
    console.log(`Calling OpenAI Generations endpoint: ${openAIEndpoint}`);
    // --- Construct JSON body for Generations API ---
    const requestBody = JSON.stringify({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: size && size !== 'auto' ? size : undefined,
      quality: quality && quality !== 'auto' ? quality : undefined
    });
    const headers = {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json'
    };
    // ---------------------------------------------
    // Call the OpenAI API
    const openAIResponse = await fetch(openAIEndpoint, {
      method: 'POST',
      headers: headers,
      body: requestBody
    });
    console.log(`OpenAI API response status: ${openAIResponse.status}`);
    // Check if the OpenAI API call was successful
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("OpenAI API Error Response Text:", errorText);
      let errorJson = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch (parseErr) {
        console.warn("Failed to parse OpenAI error response as JSON.");
      }
      const errorMessage = errorJson?.error?.message || `OpenAI API failed with status ${openAIResponse.status}. Response: ${errorText.substring(0, 200)}...`;
      return sendJSON({
        error: `Image generation failed: ${errorMessage}`
      }, openAIResponse.status);
    }
    // Parse the successful response
    const openAIResult = await openAIResponse.json();
    // --- Extract the base64 image data (Reverting to this) --- 
    const b64Json = openAIResult?.data?.[0]?.b64_json;
    if (!b64Json || typeof b64Json !== 'string') {
      console.error("Invalid response structure from OpenAI (expecting b64_json):", openAIResult);
      return sendJSON({
        error: 'Failed to parse base64 image data from OpenAI response'
      }, 500);
    }
    console.log("Successfully generated base64 image data from OpenAI. Decoding and uploading...");
    // --- Decode base64 and Upload to Supabase Storage ---
    try {
      const imageBuffer = decode(b64Json); // Decode base64 string
      const timestamp = Date.now();
      const filePath = `public/${userId}/${timestamp}_base.png`;
      // Use the ADMIN client for the upload
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from('temp-images') // <<< CHANGED BUCKET
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) {
        console.error("Error uploading base image to temp-images bucket:", uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
      if (!uploadData || !uploadData.path) {
        console.error("Base image storage upload succeeded but did not return path:", uploadData);
        throw new Error('Storage upload failed: No path returned');
      }
      // Get public URL using the ADMIN client from the correct bucket
      const { data: urlData } = supabaseAdmin.storage.from('temp-images') // <<< CHANGED BUCKET
      .getPublicUrl(filePath);
      if (!urlData || !urlData.publicUrl) {
        console.error("Failed to get public URL for temp image:", urlData);
        throw new Error('Storage upload successful, but failed to get public URL');
      }
      console.log(`Base image Temp Public URL: ${urlData.publicUrl}`);
      // --- Optionally store generation details in DB (can be simpler now) ---
      try {
        const { error: dbError } = await supabaseAdmin.from('image_generations') // Assuming you have a table
        .insert({
          user_id: userId,
          prompt: prompt,
          image_url: urlData.publicUrl,
          size: size,
          quality: quality,
          model_used: JSON.parse(requestBody)?.model || 'unknown',
          generation_step: 'base' // Add a step indicator
        });
        if (dbError) {
          console.error("Error saving base generation details to database:", dbError);
        // Non-fatal error for now
        }
      } catch (dbInsertError) {
        console.error("Exception saving base generation details to database:", dbInsertError);
      }
      // ----------------------------------------------
      // Return the public URL of the BASE image (from temp-images)
      return sendJSON({
        imageUrl: urlData.publicUrl
      });
    } catch (storageError) {
      console.error("Storage operation failed for temp-images:", storageError);
      return sendJSON({
        error: `Internal Server Error: ${storageError.message}`
      }, 500);
    }
  } catch (e) {
    const error = e;
    console.error("Unhandled error in generate-image function:", error);
    // Avoid exposing raw error details potentially
    return sendJSON({
      error: 'Internal Server Error occurred'
    }, 500);
  }
}); /*
Notes:
- This function NOW ONLY handles Step 1: Text-to-Image Generation.
- Uses OpenAI /v1/images/generations.
- Expects FormData with 'prompt', 'size', 'quality'.
- Does NOT handle input image files or reference maps.
- Returns the public URL of the generated BASE image.
*/ 
