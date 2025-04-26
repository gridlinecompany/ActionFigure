import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
// import { supabase } from '../supabaseClient'; // REMOVE global client import
import { createClient } from '@supabase/supabase-js'; // ADD createClient import
import { useAuth, useSession } from '@clerk/clerk-react'; // ADD useSession import

// Define an interface for the form data state for this component
interface ActionFigureFormDataState {
    profession: string;
    name: string;
    accessories: string;
    background: string;
    clothing: string;
    size: string;
    quality: string;
    isTransparent: boolean;
    gender: string;
    bodyStyle: string;
    skinColor: string;
    eyeColor: string;
}

// --- Define states for the multi-step process ---
type GenerationStatus = 'idle' | 'generatingBase' | 'editingImage' | 'success' | 'error';

const ActionFigureGenerator: React.FC = () => {
    const { getToken } = useAuth();
    const { session } = useSession(); // Get session
    const [formData, setFormData] = useState<ActionFigureFormDataState>({
        profession: '',
        name: '',
        accessories: '',
        background: '',
        clothing: '',
        size: 'auto',
        quality: 'auto',
        isTransparent: false,
        gender: '',
        bodyStyle: '',
        skinColor: '',
        eyeColor: '',
    });
    // const [loading, setLoading] = useState<boolean>(false); // REMOVE old loading state
    const [status, setStatus] = useState<GenerationStatus>('idle'); // ADDED: Status state
    const [error, setError] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null); // Holds FINAL image URL
    const [baseImageUrl, setBaseImageUrl] = useState<string | null>(null); // ADDED: Temp base image URL
    // const [referenceImages, setReferenceImages] = useState<File[]>([]); // REMOVE old multi-file state
    // const [imagePreviews, setImagePreviews] = useState<string[]>([]); // REMOVE old multi-preview state
    const [faceRefImage, setFaceRefImage] = useState<File | null>(null); // RENAMED: State for face reference
    const [bodyRefImage, setBodyRefImage] = useState<File | null>(null); // RENAMED: State for body reference
    const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null); // RENAMED: State for face preview URL
    const [bodyPreviewUrl, setBodyPreviewUrl] = useState<string | null>(null); // RENAMED: State for body preview URL
    // Add state for the prompt template text
    const [promptTemplate, setPromptTemplate] = useState<string>("Loading template...");
    const [shouldShowPrompt, setShouldShowPrompt] = useState<boolean>(true); // <<< State for prompt visibility
    const [loadingSetting, setLoadingSetting] = useState<boolean>(true); // <<< Loading state for setting

    // Fetch Prompt Template AND Global Setting on Mount
    useEffect(() => {
        const fetchData = async () => {
            if (!session) {
                // console.log("ActionFigureGenerator: No session, cannot fetch data.");
                setPromptTemplate("Login required to load template.");
                setLoadingSetting(false); // Mark setting as loaded (even though failed due to no session)
                setShouldShowPrompt(true); // Default to true
                return;
            }

            setLoadingSetting(true); // Start loading setting
            // Explicitly type the client variable
            let tempSupabaseClient: import('@supabase/supabase-js').SupabaseClient | null = null;

            try {
                const accessToken = await getToken({ template: 'supabase' });
                if (!accessToken) {
                    throw new Error('Could not get Supabase token from Clerk.');
                }

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (!supabaseUrl || !supabaseAnonKey) {
                    throw new Error("Supabase URL/Key missing for authenticated client.");
                }

                // Create AUTHENTICATED Supabase client
                tempSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${accessToken}` } },
                });

                // --- Fetch Template and Setting Concurrently ---
                const [templateResult, settingResult] = await Promise.all([
                    // Fetch Template
                    tempSupabaseClient
                        .from('prompt_templates')
                        .select('template_text')
                        .eq('template_id', 'actionFigure') // Ensure this ID matches
                        .single(),
                    // Fetch Setting
                    tempSupabaseClient
                        .from('global_settings')
                        .select('show_prompts_globally')
                        .eq('id', 1)
                        .single()
                ]);
                // ---------------------------------------------

                // Process Template Result
                const { data: templateData, error: templateError } = templateResult;
                if (templateError) throw new Error(`Template fetch failed: ${templateError.message}`);
                if (templateData && templateData.template_text) {
                    setPromptTemplate(templateData.template_text);
                } else {
                    setPromptTemplate("Could not load template.");
                }

                // Process Setting Result
                const { data: settingData, error: settingError } = settingResult;
                if (settingError) {
                     // console.error(`Error fetching prompt visibility setting: ${settingError.message}. Defaulting to show.`);
                     setShouldShowPrompt(true);
                } else if (settingData) {
                    setShouldShowPrompt(settingData.show_prompts_globally);
                } else {
                    // console.warn("Prompt visibility setting not found. Defaulting to show.");
                    setShouldShowPrompt(true);
                }

            } catch (error) {
                // console.error("Error fetching action figure template or setting:", error);
                setError(error instanceof Error ? error.message : String(error));
                setPromptTemplate("Error loading template.");
                // Ensure boolean is set
                setShouldShowPrompt(true); // Default to true on error
            } finally {
                setLoadingSetting(false); // Finish loading setting
            }
        };

        fetchData();
    }, [session, getToken]); // Depend on session and getToken

    // Handle text/select input changes
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value, type } = e.target;
        if (type === 'checkbox') {
            const target = e.target as HTMLInputElement;
            setFormData((prevData) => ({
                ...prevData,
                [id]: target.checked,
            }));
        } else {
            setFormData((prevData) => ({
                ...prevData,
                [id]: value,
            }));
        }
    };

    // REMOVE old multi-file handler
    /*
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        // Revoke previous object URLs to prevent memory leaks
        imagePreviews.forEach(url => URL.revokeObjectURL(url));

        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setReferenceImages(files); // Store the File objects
            // Generate and store new object URLs for previews
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setImagePreviews(newPreviews);
        } else {
            setReferenceImages([]);
            setImagePreviews([]); // Clear previews if no files are selected
        }
    };
    */

    // RENAMED: Handler for the FACE reference image input
    const handleFaceFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        // Revoke previous URL if exists
        if (facePreviewUrl) {
            URL.revokeObjectURL(facePreviewUrl);
        }

        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setFaceRefImage(file);
            setFacePreviewUrl(URL.createObjectURL(file));
        } else {
            setFaceRefImage(null);
            setFacePreviewUrl(null);
        }
    };

    // RENAMED: Handler for the BODY reference image input
    const handleBodyFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        // Revoke previous URL if exists
        if (bodyPreviewUrl) {
            URL.revokeObjectURL(bodyPreviewUrl);
        }

        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setBodyRefImage(file);
            setBodyPreviewUrl(URL.createObjectURL(file));
        } else {
            setBodyRefImage(null);
            setBodyPreviewUrl(null);
        }
    };

    // Construct the BASE prompt based on the template structure
    const constructBasePrompt = (): string => {
        const { profession, name, accessories, background, clothing } = formData;
        
        let finalPrompt = promptTemplate; // Start with the fetched template

        // Replace placeholders systematically (using new placeholder names)
        // Note: \[PROFESSION\] appears twice in the new template, this will replace both instances.
        finalPrompt = finalPrompt.replace(/\[PROFESSION\]/gi, profession || ''); // Use profession here
        finalPrompt = finalPrompt.replace(/\[CHARACTER NAME\]/gi, name || '');
        finalPrompt = finalPrompt.replace(/\[KEY ACCESSORIES\]/gi, accessories || '');
        finalPrompt = finalPrompt.replace(/\[BACKGROUND SETTING\]/gi, background || '');
        finalPrompt = finalPrompt.replace(/\[CLOTHING\/OUTFIT DESCRIPTION\]/gi, clothing || '');
        finalPrompt = finalPrompt.replace(/\[GENDER\]/gi, formData.gender || 'person'); // <-- ADDED (fallback to 'person')
        finalPrompt = finalPrompt.replace(/\[BODY STYLE\]/gi, formData.bodyStyle || 'average'); // <-- ADDED (fallback 'average')
        finalPrompt = finalPrompt.replace(/\[SKIN COLOR\]/gi, formData.skinColor || 'unspecified'); // <-- ADDED (fallback 'unspecified')
        finalPrompt = finalPrompt.replace(/\[EYE COLOR\]/gi, formData.eyeColor || 'unspecified'); // <-- ADDED (fallback 'unspecified')

        // Simple fallback if template hasn't loaded (unlikely but safe)
        if (finalPrompt.startsWith("Loading") || finalPrompt.startsWith("Could not") || finalPrompt.startsWith("Error") || finalPrompt.startsWith("Login")) {
             // console.warn("Constructing prompt with default structure because template was not loaded.");
             // Fallback to a generic structure using current values
             return `Create a hyper-realistic 3D action figure of a ${profession} named ${name}, with accessories like ${accessories}, background ${background}, and outfit ${clothing} in premium blister packaging.`;
        }

        return finalPrompt;
    };

    // Construct the EDIT prompt for using reference images
    const constructEditPrompt = (faceRefUrl: string | null, bodyRefUrl: string | null): string => {
        const instructions: string[] = [];
        
        // Add instruction for face if URL exists
        if (faceRefUrl) {
            instructions.push(`Modify the figure's face to closely resemble the reference image found at ${faceRefUrl}.`);
        }
        // Add instruction for body if URL exists
        if (bodyRefUrl) {
            instructions.push(`Modify the figure's body shape to closely resemble the reference image found at ${bodyRefUrl}.`);
        }

        // Combine instructions and add the constraint
        let finalPrompt = instructions.join(' '); // Join instructions with a space
        finalPrompt += " Make no other changes to the image.";

        // Ensure there's a base instruction if no references were actually provided
        // (Though the edit step wouldn't run in this case, it's safer)
        if (instructions.length === 0) {
            finalPrompt = "Slightly refine the base image quality. Make no other changes."; // Fallback prompt
        }
        
        // console.log("Constructed Edit Prompt (Simplified):", finalPrompt);
        return finalPrompt;
    }

    // Handle form submission (Two-Step Process)
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!session) { // Check session
            setError('Not authenticated. Please sign in.');
            setStatus('error');
            return;
        }

        setError(null);
        setResultImage(null); // Clear final result
        setBaseImageUrl(null); // Clear previous base image
        
        // Clear previews and revoke URLs on new submission
        if (facePreviewUrl) {
            URL.revokeObjectURL(facePreviewUrl);
            setFacePreviewUrl(null); // Also clear state
        }
        if (bodyPreviewUrl) {
            URL.revokeObjectURL(bodyPreviewUrl);
            setBodyPreviewUrl(null); // Also clear state
        }
        // Don't clear the actual File objects (faceRefImage, bodyRefImage) here
        // as they are needed later if the edit step runs.

        // Specific validation for this form (all text fields required)
        const textFields: (keyof ActionFigureFormDataState)[] = ['profession', 'name', 'accessories', 'background', 'clothing'];
        if (textFields.some(field => typeof formData[field] !== 'string' || !formData[field].trim())) {
            setError("Please fill in all text fields.");
            // Don't set status to error here, let user correct
            return; 
        }

        // --- Pre-upload Reference Images (if they exist) ---
        let faceRefUrl: string | null = null;
        let bodyRefUrl: string | null = null;
        let uploadError: string | null = null;
        const timestamp = Date.now(); // For unique filenames
        
        // Get Clerk token ONCE for all uploads/calls
        const accessToken = await getToken({ template: 'supabase' });
        if (!accessToken) {
             setError('Authentication error. Please sign in again.');
             setStatus('error');
             return;
        }
        
        // Create Supabase client with user token for uploads (respects RLS)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
             setError("Supabase config missing");
             setStatus('error');
             return;
        }
        const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
             global: { headers: { Authorization: `Bearer ${accessToken}` } },
        });
        
        setStatus('generatingBase'); // Set status before async uploads

        try {
            // Upload Face Reference
            if (faceRefImage) {
                // console.log("Uploading face reference image to temp bucket...");
                const filePath = `public/${session?.user.id}/${timestamp}_face_ref.png`; // Use user ID from session
                const { data: uploadData, error } = await supabaseUserClient.storage
                    .from('temp-images') // <-- Use temp-images bucket
                    .upload(filePath, faceRefImage, { contentType: faceRefImage.type, upsert: false });
                
                if (error) throw new Error(`Face reference upload failed: ${error.message}`);
                if (!uploadData?.path) throw new Error('Face reference upload succeeded but no path returned.');
                
                const { data: urlData } = supabaseUserClient.storage
                    .from('temp-images') // <-- Use temp-images bucket
                    .getPublicUrl(filePath);
                if (!urlData?.publicUrl) throw new Error('Failed to get public URL for face reference.');
                faceRefUrl = urlData.publicUrl;
                // console.log("Face reference uploaded:", faceRefUrl);
            }

            // Upload Body Reference
            if (bodyRefImage) {
                 // console.log("Uploading body reference image to temp bucket...");
                 const filePath = `public/${session?.user.id}/${timestamp}_body_ref.png`;
                 const { data: uploadData, error } = await supabaseUserClient.storage
                    .from('temp-images') // <-- Use temp-images bucket
                    .upload(filePath, bodyRefImage, { contentType: bodyRefImage.type, upsert: false });

                 if (error) throw new Error(`Body reference upload failed: ${error.message}`);
                 if (!uploadData?.path) throw new Error('Body reference upload succeeded but no path returned.');

                 const { data: urlData } = supabaseUserClient.storage
                    .from('temp-images') // <-- Use temp-images bucket
                    .getPublicUrl(filePath);
                 if (!urlData?.publicUrl) throw new Error('Failed to get public URL for body reference.');
                 bodyRefUrl = urlData.publicUrl;
                 // console.log("Body reference uploaded:", bodyRefUrl);
            }

        } catch (err) {
             uploadError = err instanceof Error ? err.message : String(err);
             // console.error('Error uploading reference image(s):', err);
             setError(`Failed to upload reference image: ${uploadError}`);
             setStatus('error');
             return; // Stop if reference upload fails
        }
        // ----------------------------------------------------

        
        // Now proceed with generation/editing steps using the obtained URLs
        // const basePrompt = constructBasePrompt(); // Move this down
        const { size, quality, isTransparent } = formData;
        
        try {
            // Token already obtained above
            // --- Step 1: Call generate-image --- 
            // console.log("Step 1: Calling generate-image...");
            const basePrompt = constructBasePrompt(); // Construct base prompt here
            const generateFormData = new FormData();
            generateFormData.append('prompt', basePrompt);
            generateFormData.append('size', size);
            generateFormData.append('quality', quality);
            generateFormData.append('background', isTransparent ? 'transparent' : 'opaque');
            // Note: generate-image doesn't need reference files directly

            const generateFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;
            const generateResponse = await fetch(generateFunctionUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: generateFormData,
            });

            if (!generateResponse.ok) {
                const errorData = await generateResponse.json().catch(() => ({ error: `HTTP error ${generateResponse.status}` }));
                throw new Error(errorData.error || `Base generation failed: ${generateResponse.statusText}`);
            }

            const generateResult = await generateResponse.json();
            if (generateResult.error || !generateResult.imageUrl) {
                throw new Error(generateResult.error || 'Base generation failed: No image URL received.');
            }

            // console.log("Step 1 Success: Base image URL:", generateResult.imageUrl);
            const currentBaseImageUrl = generateResult.imageUrl; // Store temporarily
            setBaseImageUrl(currentBaseImageUrl); // Update state for potential display

            // --- Step 2: Check if edits needed & Call edit-image --- 
            if (faceRefImage || bodyRefImage) { // Check if EITHER reference exists (file object check is fine)
                setStatus('editingImage'); // START Step 2
                // Pass URLs to constructEditPrompt
                const editPrompt = constructEditPrompt(faceRefUrl, bodyRefUrl);
                // console.log("Step 2: Calling edit-image...");

                // Fetch base image blob
                let baseImageBlob: Blob;
                try {
                    const response = await fetch(currentBaseImageUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch base image for editing: Status ${response.status}`);
                    }
                    baseImageBlob = await response.blob();
                 } catch (fetchErr) {
                     const errorMessage = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
                     throw new Error(`Failed to fetch base image for edit step: ${errorMessage}`);
                 }

                // Prepare FormData for edit-image
                const editFormData = new FormData();
                editFormData.append('image', baseImageBlob, 'base_image.png'); // The image to edit
                editFormData.append('prompt', editPrompt); // Instructions for editing
                editFormData.append('size', size); // Keep same size/quality? Or make configurable?
                editFormData.append('quality', quality); 
                // edit-image might not need background param
                // Reference images are implicitly used via the prompt, not sent directly here

                const editFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-image`; // Assuming this endpoint exists
                const editResponse = await fetch(editFunctionUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: editFormData,
                });

                if (!editResponse.ok) {
                    const errorData = await editResponse.json().catch(() => ({ error: `HTTP error ${editResponse.status}` }));
                    throw new Error(errorData.error || `Image editing failed: ${editResponse.statusText}`);
                }

                const editResult = await editResponse.json();
                if (editResult.error || !editResult.imageUrl) {
                    throw new Error(editResult.error || 'Image editing failed: No final image URL received.');
                }

                // console.log("Step 2 Success: Final image URL:", editResult.imageUrl);
                setResultImage(editResult.imageUrl); // Set FINAL image URL
                setStatus('success'); // END Step 2 (Success)

            } else {
                // No reference images - use the base image as the final result
                // console.log("Step 2: Skipped edit step (no reference images). Using base image.");
                setResultImage(currentBaseImageUrl); // Use base as final
                setStatus('success'); // END (Success without edit)
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            // console.error('Error during generation/edit process:', err);
            setError(`Process failed: ${errorMessage}`);
            setStatus('error'); // Set status to error
        }
    };

    // JSX for the component
    return (
        <>
            <h2>Action Figure Generator (2-Step)</h2>
            {/* --- Live Prompt Preview (Conditionally Rendered) --- */}
            {!loadingSetting && shouldShowPrompt && (
                 <p className="prompt-template">
                    {promptTemplate === "Loading template..." || promptTemplate.startsWith("Error") || promptTemplate.startsWith("Login") || promptTemplate.startsWith("Could not") ? (
                        <span className="placeholder">{promptTemplate}</span>
                    ) : (
                        constructBasePrompt() // Display the constructed prompt
                    )}
                 </p>
            )}
            {loadingSetting && <p>Loading settings...</p>} {/* Optional: Show loading indicator */}
            {/* ---------------------------------------------------- */}

            <div className="generator-layout"> 
                <form onSubmit={handleSubmit}>
                    {/* Update input labels and placeholders */}
                    {/* Profession Input */}
                    <div className="input-group">
                        <label htmlFor="profession">Profession:</label> 
                        <input
                            type="text"
                            id="profession"
                            placeholder="e.g., Chef, Astronaut, Spy" // Updated placeholder
                            value={formData.profession}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {/* Character Name Input */}
                    <div className="input-group">
                        <label htmlFor="name">Character Name:</label> {/* Updated label */}
                        <input
                            type="text"
                            id="name"
                            placeholder="e.g., 'Sarge' Stone, Commander Nova" // Updated placeholder
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {/* Accessories Input */}
                    <div className="input-group">
                        <label htmlFor="accessories">Key Accessories:</label> {/* Updated label */}
                        <input
                            type="text"
                            id="accessories"
                            placeholder="e.g., Tactical helmet, grappling hook, comm device" // Updated placeholder
                            value={formData.accessories}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {/* Background Input */}
                    <div className="input-group">
                        <label htmlFor="background">Background Setting:</label> {/* Updated label */}
                        <input
                            type="text"
                            id="background"
                            placeholder="e.g., Ruined city street, spaceship interior" // Updated placeholder
                            value={formData.background}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {/* Clothing Input */}
                    <div className="input-group">
                        <label htmlFor="clothing">Clothing/Outfit Description:</label> {/* Updated label */}
                        <input
                            type="text"
                            id="clothing"
                            placeholder="e.g., Kevlar vest, tactical pants, flight suit" // Updated placeholder
                            value={formData.clothing}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Body Style Input */}
                    <div className="input-group">
                        <label htmlFor="bodyStyle">Body Style:</label>
                        <input
                            type="text"
                            id="bodyStyle"
                            placeholder="e.g., Athletic, Slim, Muscular, Average"
                            value={formData.bodyStyle}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    
                    {/* Skin Color Input */}
                    <div className="input-group">
                        <label htmlFor="skinColor">Skin Color:</label>
                        <input
                            type="text"
                            id="skinColor"
                            placeholder="e.g., Fair, Tan, Medium Brown, Dark Brown"
                            value={formData.skinColor}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    
                    {/* Eye Color Input */}
                    <div className="input-group">
                        <label htmlFor="eyeColor">Eye Color:</label>
                        <input
                            type="text"
                            id="eyeColor"
                            placeholder="e.g., Blue, Green, Brown, Hazel"
                            value={formData.eyeColor}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Gender Text Input */}
                    <div className="input-group">
                        <label htmlFor="gender">Gender:</label>
                        <input
                            type="text"
                            id="gender"
                            placeholder="e.g., Woman, Man, Non-binary Person" // Example placeholder
                            value={formData.gender}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Face Reference Image Upload (Optional) */}
                    <div className="input-group">
                        <label htmlFor="faceRefImage">Face Reference (Optional):</label>
                        <input 
                            type="file" 
                            id="faceRefImage" 
                            onChange={handleFaceFileChange} 
                            accept="image/png, image/jpeg, image/webp"
                        />
                    </div>
                    {/* Display Face Preview */}
                    {facePreviewUrl && (
                        <div className="image-previews" style={{ marginBottom: '10px' }}> {/* Add margin */}
                            <img src={facePreviewUrl} alt="Face Preview" style={{ height: '50px', width: '50px', objectFit: 'cover' }} />
                        </div>
                    )}

                    {/* Body Reference Image Upload (Optional) */}
                    <div className="input-group">
                        <label htmlFor="bodyRefImage">Body Reference (Optional):</label>
                        <input 
                            type="file" 
                            id="bodyRefImage" 
                            onChange={handleBodyFileChange} 
                            accept="image/png, image/jpeg, image/webp"
                        />
                    </div>
                     {/* Display Body Preview */}
                    {bodyPreviewUrl && (
                        <div className="image-previews">
                            <img src={bodyPreviewUrl} alt="Body Preview" style={{ height: '50px', width: '50px', objectFit: 'cover' }} />
                        </div>
                    )}

                    {/* Size Dropdown */}
                    <div className="input-group">
                        <label htmlFor="size">Size:</label>
                        <select id="size" value={formData.size} onChange={handleChange}>
                            <option value="auto">Auto (Default)</option>
                            <option value="1024x1024">1024x1024 (Square)</option>
                            <option value="1024x1536">1024x1536 (Portrait)</option>
                            <option value="1536x1024">1536x1024 (Landscape)</option>
                        </select>
                    </div>

                    {/* Quality Dropdown */}
                    <div className="input-group">
                        <label htmlFor="quality">Quality:</label>
                        <select id="quality" value={formData.quality} onChange={handleChange}>
                            <option value="auto">Auto (Default)</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    {/* Transparent Background Checkbox */}
                    <div className="input-group checkbox-group">
                        <input 
                            type="checkbox" 
                            id="isTransparent" 
                            checked={formData.isTransparent}
                            onChange={handleChange} 
                        />
                        <label htmlFor="isTransparent">Transparent Background (PNG/WebP only)</label>
                    </div>
                    
                    {/* Submit Button - Updated for Status */}
                    <button 
                        type="submit" 
                        id="generate-btn" 
                        disabled={status === 'generatingBase' || status === 'editingImage'}
                    >
                        {(status === 'generatingBase' || status === 'editingImage') && (
                             <span className="loading-spinner" style={{ width: '1em', height: '1em', marginRight: '8px', borderWidth: '2px' }}></span>
                        )}
                        {getStatusText(status)} {/* Pass status to helper function */}
                    </button>
                    {error && <p className="error-message">{error}</p>} 
                </form>

                <div className="result-container">
                    <h2>Generated Image</h2>
                    {/* Display based on status */}
                    {(status === 'generatingBase' || status === 'editingImage') && (
                        <div className="loading-spinner"></div> 
                    )}                    
                    {status === 'error' && !error && ( // General error if specific message not set
                         <p className="error-message">An error occurred during generation.</p>
                    )}
                    {/* Optionally show base image during editing - uncomment if desired */} 
                    {/* {status === 'editingImage' && baseImageUrl && (
                        <img src={baseImageUrl} alt="Base image being edited" style={{ opacity: 0.6, maxWidth: '100%', marginBottom: '10px' }} />
                    )} */} 
                    {status === 'success' && resultImage && (
                        <img id="result-image" src={resultImage} alt="Generated action figure" />
                    )}
                    {status === 'idle' && !resultImage && (
                        <div className="image-placeholder">Your image will appear here</div>
                    )}
                     {/* Display base image if editing fails? Might be useful */}
                     {status === 'error' && baseImageUrl && !resultImage && (
                        <div style={{ textAlign: 'center' }}>
                            <p className="error-message">Editing failed. Displaying base image:</p>
                            <img src={baseImageUrl} alt="Base action figure (editing failed)" style={{ maxWidth: '100%' }}/>
                        </div>
                     )}
                </div>
            </div> 
        </>
    );
};

// Helper function for button/status text (Add this right before the component export)
const getStatusText = (status: GenerationStatus): string => {
    switch (status) {
        case 'generatingBase': return 'Generating Base...';
        case 'editingImage': return 'Applying Edits...';
        case 'success': return 'Generate Figure'; // Reset text after success
        case 'error': return 'Generate Figure'; // Reset text after error
        default:
        case 'idle': return 'Generate Figure';
    }
};

export default ActionFigureGenerator; 