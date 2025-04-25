document.addEventListener('DOMContentLoaded', () => {
    const professionInput = document.getElementById('profession');
    const nameInput = document.getElementById('name');
    const accessoriesInput = document.getElementById('accessories');
    const backgroundInput = document.getElementById('background');
    const clothingInput = document.getElementById('clothing');
    const generateBtn = document.getElementById('generate-btn');
    const resultContainer = document.getElementById('result-container');
    const resultImage = document.getElementById('result-image');
    const loadingSpinner = document.getElementById('loading-spinner');
    const errorMessage = document.getElementById('error-message');

    const basePromptTemplate = "Create a realistic action figure of a {profession} named {Name}. The figure is packaged in a clear plastic and cardboard box that says '{PROFESSION_UPPER}' at the top and '{NAME_UPPER}' at the bottom. The figure is standing in a neutral pose, smiling. Add accessories like {accessories}. The background should reflect their environment, such as {background}. Outfit should match the character – {clothing}. Make it look like a high-quality toy package with soft lighting and realistic design.";

    generateBtn.addEventListener('click', async () => {
        const profession = professionInput.value.trim();
        const name = nameInput.value.trim();
        const accessories = accessoriesInput.value.trim();
        const background = backgroundInput.value.trim();
        const clothing = clothingInput.value.trim();

        // Basic validation
        if (!profession || !name || !accessories || !background || !clothing) {
            showError("Please fill in all fields.");
            return;
        }

        // Construct the prompt
        let finalPrompt = basePromptTemplate
            .replace('{profession}', profession)
            .replace('{Name}', name)
            .replace('{PROFESSION_UPPER}', profession.toUpperCase())
            .replace('{NAME_UPPER}', name.toUpperCase())
            .replace('{accessories}', accessories)
            .replace('{background}', background)
            .replace('{clothing}', clothing);

        console.log("Generated Prompt:", finalPrompt);

        // Show loading state
        showLoading();

        try {
            // --- BACKEND API CALL --- 
            // Replace '/generate-image' with your actual backend endpoint
            const response = await fetch('/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: finalPrompt }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.b64_json) {
                displayImage(result.b64_json);
            } else {
                throw new Error('No image data received from server.');
            }

        } catch (error) {
            console.error('Error generating image:', error);
            showError(`Failed to generate image: ${error.message}`);
        }
    });

    function showLoading() {
        resultContainer.style.display = 'block';
        loadingSpinner.style.display = 'block';
        resultImage.style.display = 'none';
        resultImage.src = ''; // Clear previous image
        errorMessage.style.display = 'none';
        generateBtn.disabled = true;
    }

    function displayImage(base64Data) {
        loadingSpinner.style.display = 'none';
        errorMessage.style.display = 'none';
        resultImage.src = `data:image/png;base64,${base64Data}`;
        resultImage.style.display = 'block';
        generateBtn.disabled = false;
    }

    function showError(message) {
        resultContainer.style.display = 'block';
        loadingSpinner.style.display = 'none';
        resultImage.style.display = 'none';
        resultImage.src = ''; // Clear previous image if any
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        generateBtn.disabled = false;
    }
}); 