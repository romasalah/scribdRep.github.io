$(document).ready(function () {
    // ==========================================
    // Constants and Global Variables
    // ==========================================
    const validDomains = {
        scribd: /^https:\/\/(?:[a-z]{2,3}\.)?scribd\.com\/(?:document|doc|presentation)\/(\d+)\/([^\/]+)$/,
        slideshare: /^(?:https?:\/\/)?(?:www\.)?slideshare\.net\/([^\/]+)\/([^\/]+)/
    };

    let state = {
        downloadUrl: '',
        currentService: '',
        slideshareDocInfo: null,
        scribdJobId: '',
        scribdJobType: ''
    };

    // ==========================================
    // UI Elements
    // ==========================================
    const elements = {
        errorMessage: $('.error-message'),
        downloadBtn: $('#downloadBtn'),
        switchContainer: $('.switch-container'),
        switchContainer2: $('.switch-container-2'),
        scribdLink: $('#scribdLink'),
        finalDownloadBtn: $('#finalDownloadBtn'),
        sliderToggle: $('#sliderToggle'),
        sliderToggleFormat: $('#sliderToggleFormat')
    };

    // Initialize UI
    elements.switchContainer.hide();
    elements.switchContainer2.hide();

    // ==========================================
    // Utility Functions
    // ==========================================
    function sanitizeFileName(fileName) {
        try {
            // First properly decode the URI component to handle UTF-8 characters
            const decodedName = decodeURIComponent(fileName);
            return decodedName
                .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid filename chars
                .replace(/\s+/g, '_')           // Replace spaces with underscores
                .replace(/_{2,}/g, '_')         // Remove multiple consecutive underscores
                .replace(/^_+|_+$/g, '')        // Trim leading/trailing underscores
                .trim();
        } catch (e) {
            // If decoding fails, try a different approach for non-Latin characters
            return fileName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_+|_+$/g, '')
                .trim();
        }
    }

    function parseSlideShareUrl(url) {
        const match = url.match(validDomains.slideshare);
        if (!match) return null;

        const [, username, docName] = match;
        const cleanDocName = docName.split('/')[0];

        return {
            username,
            documentName: cleanDocName,
            cleanName: cleanDocName
                .replace(/-/g, ' ')
                .replace(/[^a-zA-Z0-9\u0400-\u04FF\s]/g, '') // Allow Cyrillic chars range
                .trim()
        };
    }

    // ==========================================
    // UI State Management
    // ==========================================
    function setLoadingState() {
        elements.downloadBtn
            .addClass('loading-state')
            .html('<i class="bi bi-arrow-repeat rotating-icon me-2"></i>Processing...');
    }

    function resetLoadingState() {
        elements.downloadBtn
            .removeClass('loading-state')
            .html('<i class="bi bi-download me-2"></i>Download');
    }

    function setFinalDownloadLoadingState(button) {
        button
            .prop('disabled', true)
            .html('<i class="bi bi-arrow-repeat rotating-icon me-2"></i>Downloading...');
    }

    function resetFinalDownloadLoadingState(button) {
        button
            .prop('disabled', false)
            .html('<i class="bi bi-download me-2"></i>Download');
    }

    function showError(message, type = 'danger') {
        const iconMap = {
            'danger': 'bi-exclamation-octagon',
            'info': 'bi-info-circle',
            'success': 'bi-check-circle',
            'warning': 'bi-exclamation-triangle'
        };
        
        const icon = iconMap[type] || iconMap['danger'];
        
        elements.errorMessage
            .removeClass('alert-danger alert-info alert-success alert-warning')
            .addClass(`alert-${type}`)
            .show()
            .html(`<i class="bi ${icon} me-2"></i>${message}`);
    }

    function showSuccess(message) {
        showError(message, 'success');
    }

    function showInfo(message) {
        showError(message, 'info');
    }

    function hideError() {
        elements.errorMessage.hide();
    }

    function showConfirmationModal(fileName, fileType) {
        $('#fileName').text(fileName);
        $('#fileType').text(fileType);
        $('#downloadButtonText').text(`Download as ${fileType}`);
        $('#confirmationModal').modal('show');
    }

    // ==========================================
    // Core Download Logic
    // ==========================================
    async function downloadFile(url, fileName) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to download file');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    }

    async function processSlideShare(url) {
        const hdEnabled = elements.sliderToggle.prop('checked');
        const encodedUrl = encodeURIComponent(url);
        const getUrl = `${URLS.slideshareApi.getImages}?url=${encodedUrl}&hd=${hdEnabled}`;
        
        const getResponse = await $.get(getUrl);
        if (!getResponse?.images?.length) {
            throw new Error('No images found');
        }

        const postPayload = {
            hd: hdEnabled,
            images: getResponse.images,
            type: elements.sliderToggleFormat.prop('checked') ? "pptx" : "pdf"
        };

        const postResponse = await $.ajax({
            url: URLS.slideshareApi.getSlide,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(postPayload)
        });

        if (!postResponse?.url) {
            throw new Error('Invalid server response');
        }

        return `${URLS.slideshareApi.download}?${new URLSearchParams(postResponse).toString()}`;
    }

    async function extractScribdJobInfo(htmlText) {
        // Extract job information from the script tag
        const scriptMatch = htmlText.match(/<script>[\s\S]*?\$\.ajax\({[\s\S]*?data:\s*{[\s\S]*?type:\s*['"]([^'"]+)['"][\s\S]*?id:\s*['"]([^'"]+)['"][\s\S]*?}\s*,[\s\S]*?}\);[\s\S]*?<\/script>/);
        
        if (!scriptMatch) {
            throw new Error('Job information not found in response');
        }
        
        const [, jobType, jobId] = scriptMatch;
        return { jobType, jobId };
    }

    // Enhanced status polling function with better error handling and automatic retry
    async function pollScribdStatus(jobType, jobId, maxAttempts = 40, interval = 3000) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            
            // Start polling immediately
            const pollInterval = setInterval(async () => {
                attempts++;
                
                try {
                    console.log(`Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
                    
                    const response = await $.ajax({
                        url: `${URLS.corsProxy}${encodeURIComponent(URLS.scribdCheck)}`,
                        type: 'POST',
                        dataType: 'json',
                        data: {
                            type: jobType,
                            id: jobId
                        },
                        timeout: 10000 // 10 second timeout for each request
                    });

                    // Check if the job is complete
                    if (response && response.status === true) {
                        console.log('Job completed successfully');
                        clearInterval(pollInterval);
                        resolve(response);
                        return;
                    }
                    
                    // Update progress message
                    showInfo(`Processing document... (${attempts}/${maxAttempts} checks completed)`);
                    
                    // Check if we've reached max attempts
                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        reject(new Error('Processing timeout. Please try again.'));
                        return;
                    }
                    
                    // Log current status for debugging
                    console.log(`Job status: ${response?.status || 'unknown'}, attempt ${attempts}`);
                    
                } catch (error) {
                    console.error(`Polling error on attempt ${attempts}:`, error);
                    
                    // If it's a network error and we haven't exceeded max attempts, continue
                    if (attempts < maxAttempts && (
                        error.status === 0 || 
                        error.statusText === 'timeout' || 
                        error.message.includes('network')
                    )) {
                        console.log('Network error, retrying...');
                        showInfo(`Network issue detected, retrying... (${attempts}/${maxAttempts})`);
                        return; // Continue polling
                    }
                    
                    // For other errors or max attempts reached, stop polling
                    clearInterval(pollInterval);
                    reject(new Error(`Status check failed: ${error.message || 'Unknown error'}`));
                }
            }, interval);
            
            // Set an overall timeout as a safety net
            setTimeout(() => {
                clearInterval(pollInterval);
                reject(new Error('Overall processing timeout exceeded'));
            }, maxAttempts * interval + 30000); // Extra 30 seconds buffer
        });
    }

    // Enhanced version with retry mechanism for failed status checks
    async function pollScribdStatusWithRetry(jobType, jobId, maxAttempts = 40, interval = 3000, maxRetries = 3) {
        let retryCount = 0;
        
        while (retryCount <= maxRetries) {
            try {
                return await pollScribdStatus(jobType, jobId, maxAttempts, interval);
            } catch (error) {
                retryCount++;
                console.log(`Retry ${retryCount}/${maxRetries} for job ${jobId}`);
                
                if (retryCount > maxRetries) {
                    throw error;
                }
                
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 5000));
                showInfo(`Retrying status check... (${retryCount}/${maxRetries})`);
            }
        }
    }

    // Enhanced Scribd download handler with better status management
    async function handleScribdDownload() {
        try {
            // Show progress to user
            showInfo('Initializing download process...');
            
            // Step 1: Get the initial response from scribdDownload
            const response = await fetch(state.downloadUrl);
            if (!response.ok) throw new Error(`Failed to fetch document: ${response.status}`);
            
            const htmlText = await response.text();
            
            // Step 2: Extract job information from the script tag
            const { jobType, jobId } = await extractScribdJobInfo(htmlText);
            state.scribdJobType = jobType;
            state.scribdJobId = jobId;
            
            console.log(`Started job: Type=${jobType}, ID=${jobId}`);
            
            // Update user about the processing
            showInfo('Processing document... This may take a few moments.');
            
            // Step 3: Poll the server for job completion with enhanced handling
            const statusResponse = await pollScribdStatusWithRetry(jobType, jobId);
            
            // Step 4: Download the final file
            const scribdUrl = elements.scribdLink.val().trim();
            const match = scribdUrl.match(validDomains.scribd);
            
            if (!match || match.length < 3) {
                throw new Error('Invalid Scribd URL format');
            }
            
            const [, docId, docName] = match;
            
            // Properly handle the docName for international characters
            let fileName;
            try {
                const decodedDocName = decodeURIComponent(docName);
                fileName = `${sanitizeFileName(decodedDocName)}.pdf`;
            } catch (e) {
                fileName = `${sanitizeFileName(docName)}.pdf`;
            }
            
            // Show final download step
            showInfo('Preparing download...');
            
            // Download from the final endpoint
            await downloadFile(`${URLS.corsProxy}${URLS.scribdFinal}`, fileName);
            
            // Success message
            showSuccess('Download completed successfully!');
            setTimeout(hideError, 3000); // Hide success message after 3 seconds
            
        } catch (error) {
            console.error('Detailed error:', error);
            hideError(); // Clear any processing messages
            throw error;
        }
    }

    async function handleSlideShareDownload() {
        if (!state.slideshareDocInfo) throw new Error('No SlideShare document info');
        
        const fileExt = elements.sliderToggleFormat.prop('checked') ? 'pptx' : 'pdf';
        const fileName = `${sanitizeFileName(state.slideshareDocInfo.documentName)}.${fileExt}`;
        await downloadFile(state.downloadUrl, fileName);
    }

    // ==========================================
    // Event Handlers
    // ==========================================
    elements.scribdLink.on('input', function () {
        const val = $(this).val().trim();
        hideError();
        const isSlideShare = parseSlideShareUrl(val) !== null;
        elements.switchContainer.toggle(isSlideShare);
        elements.switchContainer2.toggle(isSlideShare);
    });

    $('#downloadForm').on('submit', async function (e) {
        e.preventDefault();
        const input = elements.scribdLink.val().trim();

        if (!input) {
            this.reportValidity();
            hideError();
            return;
        }

        const isScribd = validDomains.scribd.test(input);
        state.slideshareDocInfo = parseSlideShareUrl(input);
        const isSlideshare = state.slideshareDocInfo !== null;

        if (!isScribd && !isSlideshare) {
            showError('Please insert a valid Scribd or SlideShare link!');
            return;
        }

        setLoadingState();
        hideError();
        state.currentService = isScribd ? 'scribd' : 'slideshare';

        try {
            if (isScribd) {
                const match = input.match(validDomains.scribd);
                if (!match || match.length < 3) {
                    throw new Error('Invalid Scribd URL format');
                }
                
                const [, docId, docName] = match;
                
                // Use a more flexible approach for encoding the URL
                let safeName;
                try {
                    // Try to decode first in case it's already URL-encoded
                    const decodedName = decodeURIComponent(docName);
                    // Then re-encode properly
                    safeName = encodeURIComponent(decodedName);
                } catch (e) {
                    // If decoding fails, use as is but ensure it's encoded
                    safeName = encodeURIComponent(docName);
                }
                
                state.downloadUrl = `${URLS.corsProxy}${encodeURIComponent(`${URLS.scribdDownload}${docId}/${safeName}`)}`;
                
                // Show a properly decoded name in the confirmation modal
                let displayName;
                try {
                    displayName = decodeURIComponent(docName).replace(/-/g, ' ');
                } catch (e) {
                    displayName = docName.replace(/-/g, ' ');
                }
                
                showConfirmationModal(displayName, 'PDF');
            } else {
                state.downloadUrl = await processSlideShare(input);
                showConfirmationModal(
                    state.slideshareDocInfo.documentName.replace(/-/g, ' '),
                    elements.sliderToggleFormat.prop('checked') ? 'PPTX' : 'PDF'
                );
            }
        } catch (error) {
            console.error('Processing error:', error);
            showError('Processing failed. Please try again!');
        } finally {
            resetLoadingState();
        }
    });

    elements.finalDownloadBtn.on('click', async function (e) {
        e.preventDefault();
        if (!state.downloadUrl) {
            $('#confirmationModal').modal('hide');
            return;
        }

        const button = $(this);
        setFinalDownloadLoadingState(button);

        try {
            if (state.currentService === 'scribd') {
                await handleScribdDownload();
            } else {
                await handleSlideShareDownload();
            }
        } catch (error) {
            console.error('Download error:', error);
            showError(error.message.includes('Failed to') ? error.message : 'Download failed. Please try again.');
        } finally {
            resetFinalDownloadLoadingState(button);
            $('#confirmationModal').modal('hide');
        }
    });

    // ==========================================
    // Additional Event Handlers for Better UX
    // ==========================================
    
    // Clear error messages when user starts typing
    elements.scribdLink.on('focus', function() {
        hideError();
    });

    // Handle escape key to close modals
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('#confirmationModal').modal('hide');
        }
    });

    // Auto-hide success messages after 5 seconds
    let autoHideTimeout;
    const originalShowSuccess = showSuccess;
    showSuccess = function(message) {
        originalShowSuccess(message);
        clearTimeout(autoHideTimeout);
        autoHideTimeout = setTimeout(hideError, 5000);
    };

    // Show connection status
    window.addEventListener('online', function() {
        showSuccess('Connection restored');
    });

    window.addEventListener('offline', function() {
        showError('Connection lost. Please check your internet connection.', 'warning');
    });
});
