import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
// import { supabase } from '../supabaseClient'; // REMOVE global client import
import { useSession } from '@clerk/clerk-react'; // Remove unused useAuth, keep useSession
import { createClient } from '@supabase/supabase-js'; // Import createClient
import '../style.css';

// --- State Interface ---
interface BarbieFormDataState {
    backgroundColor: string;
    colorPalette: string;
    figureName: string;
    figureSubtitle: string;
    bodyStyle: string;
    gender: string;
    skinColor: string;
    hairStyle: string;
    eyeColor: string;
    figureOutfit: string;
    figureAccessories: string;
    size: string;
    quality: string;
}

// --- Define states for the multi-step process ---
type GenerationStatus = 'idle' | 'generatingBase' | 'editingImage' | 'success' | 'error';

const BarbieStyleBoxGenerator: React.FC = () => {
    // const { getToken } = useAuth(); // REMOVE useAuth, use useSession instead
    const { session } = useSession(); // Get session hook
    // --- Form Data State ---
    const [formData, setFormData] = useState<BarbieFormDataState>({
        backgroundColor: 'Pink gradient with sparkles',
        colorPalette: 'Pink, white, silver',
        figureName: '',
        figureSubtitle: '',
        bodyStyle: 'Athletic',
        gender: 'Woman',
        skinColor: '',
        hairStyle: '',
        eyeColor: '',
        figureOutfit: '',
        figureAccessories: '',
        size: '1024x1024', // Default size update if needed
        quality: 'auto', // Default quality
    });
    // --- Process State ---
    const [status, setStatus] = useState<GenerationStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null); // Will hold the FINAL edited image URL
    const [faceReferenceImage, setFaceReferenceImage] = useState<File | null>(null);
    const [bodyReferenceImage, setBodyReferenceImage] = useState<File | null>(null);
    const [promptTemplate, setPromptTemplate] = useState<string>("Loading template...");
    const [shouldShowPrompt, setShouldShowPrompt] = useState<boolean>(true);
    const [loadingSetting, setLoadingSetting] = useState<boolean>(true);

    // Fetch Prompt Template AND Global Setting on Mount
    useEffect(() => {
        // Fetch data only when session is available
        if (!session) return;

        // Reset states
        setLoadingSetting(true);
        // Keep promptTemplate loading state as is initially

        const fetchData = async () => {
            // Explicitly type the client variable
            let tempSupabaseClient: import('@supabase/supabase-js').SupabaseClient | null = null;
            try {
                // Create a temporary client JUST for these reads, authenticated with Clerk
                const supabaseAccessToken = await session.getToken({ template: 'supabase' });
                if (!supabaseAccessToken) throw new Error('Clerk token not available');

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase config missing');

                tempSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${supabaseAccessToken}` } }
                });
                // ---------------------------------------------------------------------

                // --- Fetch Template and Setting Concurrently ---
                const [templateResult, settingResult] = await Promise.all([
                    // Fetch Template
                    tempSupabaseClient
                        .from('prompt_templates')
                        .select('template_text')
                        .eq('template_id', 'barbieStyleBox') // Make sure this ID is correct
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
                    console.log("Prompt template loaded.");
                } else {
                    setPromptTemplate("Could not load template.");
                }

                // Process Setting Result
                const { data: settingData, error: settingError } = settingResult;
                if (settingError) {
                     // Log error, but default to showing the prompt if setting fetch fails
                     console.error(`Error fetching prompt visibility setting: ${settingError.message}. Defaulting to show.`);
                     setShouldShowPrompt(true);
                } else if (settingData) {
                    setShouldShowPrompt(settingData.show_prompts_globally);
                    console.log(`Prompt visibility setting loaded: ${settingData.show_prompts_globally}`);
                } else {
                    console.warn("Prompt visibility setting not found. Defaulting to show.");
                    setShouldShowPrompt(true); // Default to show if row/value doesn't exist
                }

            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error("Error fetching template or setting:", err);
                // Set specific errors or a general one
                setPromptTemplate(`Error loading template/setting: ${message}`);
                // Ensure boolean is set for setShouldShowPrompt
                setShouldShowPrompt(true); // Default to showing prompts on error
            } finally {
                 setLoadingSetting(false); // Mark setting as loaded (or failed)
            }
        };
        fetchData();
    }, [session]); // Depend on session

    // --- Handle Input Changes (Text, Select, Files) ---
    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [id]: value }));
    };

    const handleFaceFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFaceReferenceImage(e.target.files[0]);
        } else {
            setFaceReferenceImage(null);
        }
    };

    const handleBodyFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setBodyReferenceImage(e.target.files[0]);
        } else {
            setBodyReferenceImage(null);
        }
    };

    // --- Construct Base Prompt ---
    const constructBasePrompt = (): string => {
        const template = promptTemplate;
        if (template.startsWith("Loading") || template.startsWith("Error")) {
            return "Template not ready...";
        }
        let filledPrompt = template;
        // ... (Replace placeholders as before using formData values) ...
        filledPrompt = filledPrompt.replace(/\[Background color or design\]/g, formData.backgroundColor || '');
        filledPrompt = filledPrompt.replace(/\[Color palette\]/g, formData.colorPalette || '');
        filledPrompt = filledPrompt.replace(/\[Name\]/g, formData.figureName || '');
        filledPrompt = filledPrompt.replace(/\[Subtitle\]/g, formData.figureSubtitle || '');
        filledPrompt = filledPrompt.replace(/\[body style\]/g, formData.bodyStyle || '');
        filledPrompt = filledPrompt.replace(/\[gender\]/g, formData.gender || '');
        filledPrompt = filledPrompt.replace(/\[skin color\]/g, formData.skinColor || '');
        filledPrompt = filledPrompt.replace(/\[hair color and style\]/g, formData.hairStyle || '');
        filledPrompt = filledPrompt.replace(/\[eye color\]/g, formData.eyeColor || '');
        filledPrompt = filledPrompt.replace(/\[Outfit\]/g, formData.figureOutfit || '');
        filledPrompt = filledPrompt.replace(/\[Accessories\]/g, formData.figureAccessories || '');
        return filledPrompt;
    };

    // --- Construct Edit Prompt ---
    const constructEditPrompt = (): string => {
        let editInstructions = "Edit the base image."; // Base instruction
        const additions: string[] = [];

        if (faceReferenceImage) {
            additions.push("Modify the face to closely match the user's reference photo");
        }
        if (bodyReferenceImage) {
            additions.push("modify the body shape and proportions to closely match the user's reference photo");
        }

        if (additions.length > 0) {
            editInstructions += ` ${additions.join(' and ')}.`;
        } else {
            // If no references, maybe just refine?
            editInstructions = "Slightly refine the generated image, enhancing details and realism.";
        }

        // Add style preservation instructions
        editInstructions += " Maintain the overall Barbie collectible doll style, proportions, pose, lighting, and the original background/theme unless specified otherwise.";

        // Optional: Add specific details from formData if needed for edits?
        // editInstructions += ` Ensure the outfit is ${formData.figureOutfit}.`;

        console.log("Constructed Edit Prompt:", editInstructions);
        return editInstructions;
    };

    // --- Handle Form Submission (Two-Step Process) ---
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!session) { // Ensure session exists before submitting
             setError('Not authenticated. Please sign in.');
             setStatus('error');
             return;
        }
        
        setError(null);
        setResultImage(null); 
        setStatus('generatingBase');

        // --- Basic Validation ---
        if (!formData.figureName.trim() || !formData.figureOutfit.trim()) {
            setError("Please fill in at least Name and Outfit.");
            setStatus('error');
            return;
        }

        const basePrompt = constructBasePrompt();
        const { size, quality } = formData;
        // Get token directly from session
        const accessToken = await session.getToken({ template: 'supabase' }); 

        if (!accessToken) {
            setError('Authentication error. Please sign in again.');
            setStatus('error');
            return;
        }

        // === Step 1: Call generate-image Function ===
        try {
            console.log("Step 1: Calling generate-image...");
            const generateFormData = new FormData();
            generateFormData.append('prompt', basePrompt);
            generateFormData.append('size', size);
            generateFormData.append('quality', quality);

            const generateResponse = await fetch(
                'https://rwltgtdrhpdlfjqhltrn.supabase.co/functions/v1/generate-image', 
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` }, // Use token directly
                    body: generateFormData,
                }
            );

            if (!generateResponse.ok) {
                const errorData = await generateResponse.json().catch(() => ({ error: `HTTP error ${generateResponse.status}` }));
                throw new Error(errorData.error || `Base generation failed: ${generateResponse.statusText}`);
            }

            const generateResult = await generateResponse.json();
            if (generateResult.error || !generateResult.imageUrl) {
                throw new Error(generateResult.error || 'Base generation failed: No image URL received.');
            }

            console.log("Step 1 Success: Base image URL:", generateResult.imageUrl);

            // === Step 2: Check if edits are needed and Call edit-image Function ===
            if (faceReferenceImage || bodyReferenceImage) { 
                 setStatus('editingImage');
                 const editPrompt = constructEditPrompt();
                 console.log("Step 2: Calling edit-image with FormData");

                 // Fetch base image blob
                 let baseImageBlob: Blob;
                 try {
                    console.log(`Fetching base image data from: ${generateResult.imageUrl}`);
                    const response = await fetch(generateResult.imageUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch base image for editing: Status ${response.status}`);
                    }
                    baseImageBlob = await response.blob();
                    console.log(`Fetched base image blob, size: ${baseImageBlob.size}, type: ${baseImageBlob.type}`);
                 } catch (fetchErr) {
                     console.error("Error fetching base image blob:", fetchErr);
                     // Type assertion for error message extraction
                     const errorMessage = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
                     throw new Error(`Failed to fetch base image for edit step: ${errorMessage}`);
                 }
                 // ------------------------------------------------------

                 // Prepare FormData for edit-image function
                 const editCallFormData = new FormData();
                 editCallFormData.append('image', baseImageBlob, 'base_image.png');
                 editCallFormData.append('prompt', editPrompt);
                 editCallFormData.append('size', size);
                 editCallFormData.append('quality', quality);
                 
                 const editResponse = await fetch(
                    'https://rwltgtdrhpdlfjqhltrn.supabase.co/functions/v1/edit-image', 
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}` // Use same token directly
                        },
                        body: editCallFormData, 
                    }
                 );

                 if (!editResponse.ok) {
                    const errorData = await editResponse.json().catch(() => ({ error: `HTTP error ${editResponse.status}` }));
                    throw new Error(errorData.error || `Image editing failed: ${editResponse.statusText}`);
                 }

                 const editResult = await editResponse.json();
                 if (editResult.error || !editResult.imageUrl) {
                     throw new Error(editResult.error || 'Image editing failed: No final image URL received.');
                 }

                 console.log("Step 2 Success: Final image URL:", editResult.imageUrl);
                 setResultImage(editResult.imageUrl); 
                 setStatus('success');

            } else {
                // No reference images - use the base image as the final result
                console.log("Step 2: Skipped edit step (no reference images). Using base image.");
                setResultImage(generateResult.imageUrl);
                setStatus('success');
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error during generation/edit process:', err);
            setError(`Process failed: ${errorMessage}`);
            setStatus('error');
        }
    };

    // --- Helper to get display text for status ---
    const getStatusText = () => {
        switch (status) {
            case 'generatingBase': return 'Generating base image...';
            case 'editingImage': return 'Applying reference details...';
            case 'success': return 'Generation Complete!';
            case 'error': return 'An error occurred.';
            default: return 'Generate Image';
        }
    };

    // --- Helper function to get form data value by placeholder text (minor update needed) ---
    const getFormDataValue = (placeholder: string): string => {
       // ... (Keep the switch statement as it was, ensure all formData keys match)
       switch (placeholder.toLowerCase()) { // Convert placeholder to lowercase for case-insensitive matching
            case 'background color or design': return formData.backgroundColor;
            case 'color palette': return formData.colorPalette;
            case 'name': return formData.figureName;
            case 'subtitle': return formData.figureSubtitle;
            case 'body style': return formData.bodyStyle;
            case 'gender': return formData.gender;
            case 'skin color': return formData.skinColor;
            case 'hair color and style': return formData.hairStyle;
            case 'eye color': return formData.eyeColor;
            case 'outfit': return formData.figureOutfit; // Match lowercase
            case 'accessories': return formData.figureAccessories;
            default:
                // Keep the warning but don't log excessively during normal operation
                // console.warn(`Unhandled placeholder in getFormDataValue: ${placeholder}`); 
                return '';
        }
    }

    // --- JSX --- 
    return (
        <>
            <h2>Barbie Style Box Generator (2-Step)</h2>
            {/* --- Live Prompt Preview (Conditionally Rendered) --- */}
            {!loadingSetting && shouldShowPrompt && (
                <p className="prompt-template">
                    {/* Keep the prompt preview logic as it was */}
                    {promptTemplate === "Loading template..." || promptTemplate.startsWith("Error loading") ? (
                        <span className="placeholder">{promptTemplate}</span> // Show loading/error state
                    ) : (
                        promptTemplate.split('[').map((part, index) => {
                            if (index === 0) return part;
                            const placeholderEndIndex = part.indexOf(']');
                            if (placeholderEndIndex === -1) return part;
                            const placeholderText = part.substring(0, placeholderEndIndex);
                            const restOfText = part.substring(placeholderEndIndex + 1);
                            const formValue = getFormDataValue(placeholderText);
                            return (
                                <React.Fragment key={index}>
                                    {formValue ? (
                                        <>{formValue}</>
                                    ) : (
                                        <span className="placeholder">[{placeholderText}]</span>
                                    )}
                                    {restOfText}
                                </React.Fragment>
                            );
                        })
                    )}
                </p>
            )}
            {loadingSetting && <p>Loading settings...</p>} {/* Optional: Show loading indicator */}
            {/* ---------------------------------------------------- */}

            <div className="generator-layout">
                <form onSubmit={handleSubmit}>
                    {/* --- Form Inputs (Keep as they were) --- */}
                    <div className="input-group">
                        <label htmlFor="backgroundColor">Background Color/Design:</label>
                        <input type="text" id="backgroundColor" value={formData.backgroundColor} onChange={handleChange} placeholder="e.g., Pink gradient with sparkles" required />
                    </div>
                    {/* ... other text inputs ... */}                    
                    <div className="input-group">
                        <label htmlFor="colorPalette">Color Palette:</label>
                        <input type="text" id="colorPalette" value={formData.colorPalette} onChange={handleChange} placeholder="e.g., Pink, white, silver" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="figureName">Figure Name:</label>
                        <input type="text" id="figureName" value={formData.figureName} onChange={handleChange} placeholder="e.g., Superstar Christie" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="figureSubtitle">Subtitle:</label>
                        <input type="text" id="figureSubtitle" value={formData.figureSubtitle} onChange={handleChange} placeholder="e.g., Limited Edition 2024" />
                    </div>
                    <div className="input-group">
                        <label htmlFor="bodyStyle">Body Style:</label>
                        <input type="text" id="bodyStyle" value={formData.bodyStyle} onChange={handleChange} placeholder="e.g., Athletic, Curvy" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="gender">Gender:</label>
                        <input type="text" id="gender" value={formData.gender} onChange={handleChange} placeholder="e.g., Woman, Man" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="skinColor">Skin Color:</label>
                        <input type="text" id="skinColor" value={formData.skinColor} onChange={handleChange} placeholder="e.g., Tan, Light brown" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="hairStyle">Hair Color and Style:</label>
                        <input type="text" id="hairStyle" value={formData.hairStyle} onChange={handleChange} placeholder="e.g., Long blonde wavy hair" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="eyeColor">Eye Color:</label>
                        <input type="text" id="eyeColor" value={formData.eyeColor} onChange={handleChange} placeholder="e.g., Blue" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="figureOutfit">Outfit:</label>
                        <textarea id="figureOutfit" value={formData.figureOutfit} onChange={handleChange} placeholder="e.g., Sparkly pink ballgown, Casual jeans and t-shirt" required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="figureAccessories">Accessories:</label>
                        <textarea id="figureAccessories" value={formData.figureAccessories} onChange={handleChange} placeholder="e.g., Handbag, sunglasses, miniature dog" />
                    </div>

                    {/* --- Standard Options (Size/Quality) --- */}
                    <div className="input-group">
                        <label htmlFor="size">Size:</label>
                        <select id="size" value={formData.size} onChange={handleChange}>
                            {/* Ensure these sizes match the target model */}
                            <option value="auto">Auto (default)</option>
                            <option value="1024x1024">1024x1024 (Square)</option>
                            <option value="1024x1536">1024x1536 (Portrait)</option>
                            <option value="1536x1024">1536x1024 (Landscape)</option>
                        </select>
                    </div>
                     <div className="input-group">
                        <label htmlFor="quality">Quality:</label> {/* Updated label */} 
                        <select id="quality" value={formData.quality} onChange={handleChange}>
                            <option value="auto">Auto (default)</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    {/* --- Reference Image Inputs --- */}
                     <div className="input-group">
                        <label htmlFor="faceReferenceImage">Face Reference (Optional):</label>
                        <input type="file" id="faceReferenceImage" accept="image/png, image/jpeg, image/webp" onChange={handleFaceFileChange} disabled={status === 'generatingBase' || status === 'editingImage'} />
                        {faceReferenceImage && <span className="file-name">Selected: {faceReferenceImage.name}</span>}
                    </div>
                     <div className="input-group">
                        <label htmlFor="bodyReferenceImage">Body Reference (Optional):</label>
                        <input type="file" id="bodyReferenceImage" accept="image/png, image/jpeg, image/webp" onChange={handleBodyFileChange} disabled={status === 'generatingBase' || status === 'editingImage'} />
                        {bodyReferenceImage && <span className="file-name">Selected: {bodyReferenceImage.name}</span>}
                    </div>
                    {/* ----------------------------- */}

                    <button type="submit" id="generate-btn" disabled={status === 'generatingBase' || status === 'editingImage'}>
                        {status === 'generatingBase' || status === 'editingImage' ? (
                            <span className="loading-spinner" style={{width: '20px', height: '20px', borderWidth: '3px'}}></span>
                        ) : null}
                        {getStatusText()}
                    </button>
                </form>
                <div className="result-container">
                    <h2>Generated Image</h2>
                    {/* Show appropriate message/spinner based on status */} 
                    {(status === 'generatingBase' || status === 'editingImage') && <div className="loading-spinner"></div>}
                    {status === 'error' && error && <p className="error-message">{error}</p>}
                    {/* Show base image during edit step? Optional */} 
                    {/* {status === 'editingImage' && baseImageUrl && <img src={baseImageUrl} alt="Base Generated Image" style={{ opacity: 0.5 }} />} */} 
                    {status === 'success' && resultImage && <img id="result-image" src={resultImage} alt="Final Generated Barbie Style Box" />}
                    {status === 'idle' && !resultImage && <div className="image-placeholder">Your generated image will appear here</div>}
                </div>
            </div>
        </>
    );
};

export default BarbieStyleBoxGenerator; 