📖 Barbie Style Box Generator
Reference Image Handling (Improved Version)
This document outlines the optimized process for capturing, storing, and submitting reference images to the generate-image Supabase Edge Function.

📥 1. File Selection
tsx
Copy
Edit
<input
  type="file"
  id="image"
  multiple
  accept="image/png, image/jpeg, image/webp"
  onChange={handleFileChange}
/>
Allows users to select one or multiple image files.

Only accepts PNG, JPEG, and WEBP formats.

🛠 2. Storing Files in React State
typescript
Copy
Edit
const [referenceImages, setReferenceImages] = useState<File[]>([]);

const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
  if (e.target.files) {
    setReferenceImages(Array.from(e.target.files));
  } else {
    setReferenceImages([]);
  }
};
Files are captured from event.target.files.

Stored as an array of File objects.

📤 3. Preparing FormData on Submit
typescript
Copy
Edit
const handleSubmit = async () => {
  const dataToSend = new FormData();

  // Text fields
  dataToSend.append('prompt', finalPrompt);
  dataToSend.append('size', size);
  dataToSend.append('quality', quality);

  // Images with unique keys
  if (referenceImages.length > 0) {
    referenceImages.forEach((file, index) => {
      dataToSend.append(`reference_${index + 1}`, file);
    });

    // (Optional) Reference mapping for instructions
    const referenceMap = {
      reference_1: "Use for body shape and facial structure",
      reference_2: "Use for outfit and pose",
    };
    dataToSend.append('reference_map', JSON.stringify(referenceMap));
  }

  // Sending the request
  const response = await fetch(supabaseFunctionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: dataToSend,
  });

  // Handle the response...
};
🔥 Key Improvements

Aspect	Improvement
Image Key Naming	Each image is named individually (reference_1, reference_2, etc.)
Optional Reference Map	A JSON map is sent describing how each reference should be used
Scalability	Future-proofs handling for multiple references
Performance (Optional)	Large images can be resized before upload
🎯 Why These Changes Matter
Explicit matching: Helps the AI model understand which image affects which part of the generation (e.g., face vs. outfit).

Precise scaling: Makes it easier to add more images later without refactoring.

Optimized processing: Reduces upload times and processing cost if using optional compression.

🚀 Future Enhancements (Optional)
Integrate frontend image compression (e.g., using browser-image-compression).

Expand the reference_map to include weighting (e.g., 80% face from reference_1, 20% from reference_2).

Validate image sizes and types before upload for better UX.

📜 Backend (Edge Function) Expectations
The generate-image function should:

Accept a multipart/form-data POST request.

Parse prompt, size, quality, and reference_map.

Load multiple uploaded images (reference_1, reference_2, etc.).

Optionally, parse reference_map for smarter prompt construction.

✅ Example Expected Payload (FormData)

Key	Value (example)
prompt	"Create an ultra-realistic Barbie figure"
size	"1024x1024"
quality	"high"
reference_1	Binary image file (body shape)
reference_2	Binary image file (outfit and pose)
reference_map	{"reference_1":"body","reference_2":"outfit"}
🧹 Clean Code Snippet Summary
typescript
Copy
Edit
referenceImages.forEach((file, index) => {
  dataToSend.append(`reference_${index + 1}`, file);
});
dataToSend.append('reference_map', JSON.stringify({
  reference_1: "Use for body shape and facial structure",
  reference_2: "Use for outfit and pose",
}));
📦 Final Notes
Implementing these small changes will:

Maximize faithfulness to user-uploaded references.

Improve prompt clarity.

Future-proof your image generation pipeline for advanced customization like multiple poses, outfits, accessories, etc.

✅ Ready to implement.
