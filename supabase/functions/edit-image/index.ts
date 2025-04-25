// Required for Supabase functions
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts"; // Keep decode for final upload if needed
import { corsHeaders } from '../_shared/cors.ts';
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
// Helper to extract User ID from JWT (same as in generate-image)
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
    let payloadB64 = payloadB64Url.replace(/-/g, '+').replace(/_/g, '/');
    switch(payloadB64.length % 4){
      case 2:
        payloadB64 += '==';
        break;
      case 3:
        payloadB64 += '=';
        break;
    }
    const decodedPayloadString = new TextDecoder().decode(decode(payloadB64));
    const payload = JSON.parse(decodedPayloadString);
    return payload.sub || null;
  } catch (error) {
    console.error('Error decoding/parsing JWT payload:', error);
    return null;
  }
};
console.log("edit-image function initializing (Multipart Mode)");
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // --- Create Supabase Admin Client ---
  let supabaseAdmin;
  try {
    supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    console.log("Supabase admin client initialized for edit function.");
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
  console.log(`Edit request for User ID: ${userId}`);
  try {
    // Ensure it's a POST request
    if (req.method !== 'POST') {
      return sendJSON({
        error: 'Method Not Allowed'
      }, 405);
    }
    // Content-Type check removed - expecting FormData
    // --- Parse the multipart/form-data request body --- 
    let incomingFormData;
    try {
      incomingFormData = await req.formData();
    } catch (e) {
      console.error("Failed to parse incoming FormData:", e);
      return sendJSON({
        error: `Bad Request: Invalid FormData - ${e.message}`
      }, 400);
    }
    // --- Extract data from incoming FormData --- 
    const baseImageFile = incomingFormData.get('image');
    const edit_prompt = incomingFormData.get('prompt');
    const size = incomingFormData.get('size');
    const quality = incomingFormData.get('quality');
    const n = 1; // Assuming n=1 for edits
    // const maskFile = incomingFormData.get('mask') as File | null; // Add if implementing masks
    // --- Validate input ---
    if (!baseImageFile) {
      return sendJSON({
        error: 'Missing "image" file in form data'
      }, 400);
    }
    if (!edit_prompt || typeof edit_prompt !== 'string') {
      return sendJSON({
        error: 'Missing or invalid "prompt" in form data'
      }, 400);
    }
    // Optional: Validate size/quality values
    console.log(`Received base image file: ${baseImageFile.name}, size: ${baseImageFile.size}, type: ${baseImageFile.type}`);
    console.log(`Received edit prompt: ${edit_prompt.substring(0, 100)}...`);
    if (size) console.log(`Received size for edit: ${size}`);
    if (quality) console.log(`Received quality for edit: ${quality}`);
    // --- Prepare FormData for OpenAI /v1/images/edits --- 
    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      console.error("OPENAI_API_KEY environment variable not set!");
      return sendJSON({
        error: 'Internal Server Error: Missing API configuration'
      }, 500);
    }
    const openAIEndpoint = 'https://api.openai.com/v1/images/edits';
    console.log(`Calling OpenAI Edits endpoint with FormData: ${openAIEndpoint}`);
    const openAiFormData = new FormData();
    openAiFormData.append('image', baseImageFile, baseImageFile.name || 'image.png'); // Send the file received from frontend
    openAiFormData.append('prompt', edit_prompt);
    openAiFormData.append('model', 'gpt-image-1');
    openAiFormData.append('n', n.toString());
    if (size && size !== 'auto') {
      openAiFormData.append('size', size);
    }
    if (quality && quality !== 'auto') {
      openAiFormData.append('quality', quality);
    }
    // openAiFormData.append('response_format', 'url'); // REMOVED: Causes error with multipart
    // if (maskFile) { // Add if implementing masks
    //    openAiFormData.append('mask', maskFile, maskFile.name || 'mask.png');
    // }
    // Call the OpenAI Edits API
    const openAIResponse = await fetch(openAIEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`
      },
      body: openAiFormData
    });
    console.log(`OpenAI Edits API response status: ${openAIResponse.status}`);
    // Check if the OpenAI API call was successful
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("OpenAI Edits API Error Response Text:", errorText);
      let errorJson = {};
      try {
        errorJson = JSON.parse(errorText);
      } catch (_) {}
      const errorMessage = errorJson?.error?.message || `OpenAI Edits API failed with status ${openAIResponse.status}. Response: ${errorText.substring(0, 200)}...`;
      return sendJSON({
        error: `Image editing failed: ${errorMessage}`
      }, openAIResponse.status);
    }
    // Parse the successful response (expecting b64_json by default now)
    const openAIResult = await openAIResponse.json();
    const b64Json = openAIResult?.data?.[0]?.b64_json;
    if (!b64Json || typeof b64Json !== 'string') {
      console.error("Invalid response structure from OpenAI Edits (expecting b64_json):", openAIResult);
      return sendJSON({
        error: 'Failed to parse final image base64 data from OpenAI edit response'
      }, 500);
    }
    console.log("Successfully received final image base64 data from OpenAI. Decoding and uploading...");
    // --- Decode base64 and Upload Final Edited Image to Supabase Storage ---
    try {
      const finalImageBuffer = decode(b64Json); // Decode the base64 response
      const timestamp = Date.now();
      const filePath = `public/${userId}/${timestamp}_edited.png`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from('generated-images').upload(filePath, finalImageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) {
        console.error("Error uploading edited image to storage:", uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
      if (!uploadData || !uploadData.path) {
        console.error("Edited image storage upload succeeded but did not return path:", uploadData);
        throw new Error('Storage upload failed: No path returned');
      }
      const { data: urlData } = supabaseAdmin.storage.from('generated-images').getPublicUrl(filePath);
      if (!urlData || !urlData.publicUrl) {
        console.error("Failed to get public URL for edited image:", urlData);
        throw new Error('Edited image storage successful, but failed to get public URL');
      }
      console.log(`Edited image Supabase Public URL: ${urlData.publicUrl}`);
      // Optional DB logging ...
      try {
        const { error: dbError } = await supabaseAdmin.from('image_generations').insert({
          user_id: userId,
          prompt: edit_prompt,
          image_url: urlData.publicUrl,
          size: size,
          quality: quality,
          model_used: 'gpt-image-1',
          generation_step: 'edit',
          base_image_source_url: "unknown"
        });
        if (dbError) {
          console.error("Error saving edit details to database:", dbError);
        }
      } catch (dbInsertError) {
        console.error("Exception saving edit details to database:", dbInsertError);
      }
      return sendJSON({
        imageUrl: urlData.publicUrl
      });
    } catch (storageError) {
      console.error("Storage operation failed during edit upload:", storageError);
      return sendJSON({
        error: `Internal Server Error: ${storageError.message}`
      }, 500);
    }
  } catch (e) {
    const error = e;
    console.error("Unhandled error in edit-image function:", error);
    return sendJSON({
      error: 'Internal Server Error occurred'
    }, 500);
  }
}); /*
Notes:
- Handles image editing using OpenAI /v1/images/edits.
- Expects MULTIPART/FORM-DATA input: { image: File, prompt: string, size?: string, quality?: string }.
- Sends MULTIPART/FORM-DATA to OpenAI: { image: File, prompt, model, size?, quality?, n=1 } (NO response_format).
- Expects b64_json back from OpenAI.
- Decodes base64, uploads final image buffer to Supabase storage.
- Returns the Supabase public URL of the final image.
*/ 
